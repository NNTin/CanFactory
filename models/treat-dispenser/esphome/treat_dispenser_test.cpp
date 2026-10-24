// Host test of the treat dispenser's firmware logic (treat_dispenser.h), the same code the ESPHome configuration runs. A simulated
// motor moves at the configured speed; a simulated flash holds the committed "at rest" flag; a power cut can fall between any two
// polls. Built and run by tools/esphome/treat-dispenser-firmware.test.ts:  g++ -std=c++17 treat_dispenser_test.cpp && ./a.out
#include <cstdio>
#include <cstdlib>
#include <vector>

#include "treat_dispenser.h"

using namespace treat_dispenser;

static int failures = 0, checks = 0;
#define CHECK(cond)                                                                    \
  do {                                                                                 \
    checks++;                                                                          \
    if (!(cond)) { failures++; std::printf("FAIL %s:%d %s\n", __FILE__, __LINE__, #cond); } \
  } while (0)

/** A device: the logic, a motor that steps towards its target at max_speed, and a flash with one committed flag. */
struct Device {
  Config config;
  long position = 0, target = 0;
  bool committed = false;
  bool stuck = false;
  double credit = 0;
  std::vector<long> moves;
  std::vector<uint32_t> move_times;
  uint32_t now = 0;
  Logic logic;

  explicit Device(Config c, bool flash = false)
      : config(c), committed(flash),
        logic(c, Hooks{[this](long steps) { target += steps; moves.push_back(steps); move_times.push_back(now); },
                       [this]() { target = position; },
                       [this](bool at_rest) { committed = at_rest; }}) {
    logic.boot(committed);
  }
  bool idle() const { return position == target; }
  /** Advance by `ms` in 5 ms polls. */
  void run(uint32_t ms) {
    for (uint32_t t = 0; t < ms; t += 5) {
      now += 5;
      if (!stuck) {
        // max_speed half-steps per second, exactly (no acceleration: faster than the real motor, so timings are lower bounds)
        credit += config.max_speed * 0.005;
        const long step = static_cast<long>(credit);
        credit -= static_cast<double>(step);
        if (position < target) position = std::min(target, position + step);
        else if (position > target) position = std::max(target, position - step);
      }
      logic.poll(now, idle());
    }
  }
  /** Run until nothing runs (or `limit` ms). */
  void settle(uint32_t limit = 60000) {
    for (uint32_t t = 0; t < limit && logic.state() == State::Running; t += 5) run(5);
  }
  /** A power cut or RESET: the motor stops where it is; the device boots with what flash committed. */
  void power_cycle() {
    target = position;
    logic = Logic(config, Hooks{[this](long steps) { target += steps; moves.push_back(steps); move_times.push_back(now); },
                                [this]() { target = position; },
                                [this](bool at_rest) { committed = at_rest; }});
    logic.boot(committed);
  }
};

static Config defaults() { return Config{}; }

int main() {
  // a fresh device has no committed rest: it boots unaligned, refuses to dispense, and accepts a jog and "mark aligned"
  {
    Device d(defaults());
    CHECK(d.logic.state() == State::Unaligned);
    CHECK(d.logic.request(Request::Dispense) == Outcome::Rejected);
    CHECK(d.logic.request(Request::Prime) == Outcome::Rejected);
    CHECK(d.logic.request(Request::Calibrate) == Outcome::Rejected);
    CHECK(d.logic.request(Request::Jog, 23) == Outcome::Started);
    d.settle();
    CHECK(d.moves.size() == 1 && d.moves[0] == -23);
    CHECK(d.logic.state() == State::Unaligned);
    CHECK(d.logic.request(Request::MarkAligned) == Outcome::Done);
    CHECK(d.logic.state() == State::Ready && d.committed);
    CHECK(d.logic.rejected() == 3);
  }

  // one press: a full turn (4076 half-steps, signed by the direction), counted only once it has finished and the settle has
  // passed; "not at rest" committed before the first step
  {
    Device d(defaults(), true);
    CHECK(d.logic.state() == State::Ready);
    CHECK(d.logic.request(Request::Dispense) == Outcome::Started);
    CHECK(!d.committed);
    d.run(5);
    CHECK(d.moves.size() == 1 && d.moves[0] == -4076);
    d.run(5800);
    CHECK(d.logic.cycles() == 0);
    d.settle();
    CHECK(d.moves.size() == 1);
    CHECK(d.logic.cycles() == 1 && d.logic.state() == State::Ready && d.committed);
    CHECK(d.position == -4076);
  }

  // presses while a dispense runs: one queues and then really runs, a further one is rejected (the old script lost the queued one)
  {
    Device d(defaults(), true);
    CHECK(d.logic.request(Request::Dispense) == Outcome::Started);
    d.run(200);
    CHECK(d.logic.request(Request::Dispense) == Outcome::Queued);
    CHECK(d.logic.request(Request::Dispense) == Outcome::Rejected);
    CHECK(d.logic.queued() == 1);
    d.settle();
    CHECK(d.logic.cycles() == 2 && d.moves.size() == 2 && d.position == -8152);
    CHECK(d.logic.queued() == 0 && d.logic.rejected() == 1 && d.committed);
  }

  // one runner owns the motor: during a dispense, prime, calibration, jog and "mark aligned" are rejected and move nothing
  {
    Device d(defaults(), true);
    d.logic.request(Request::Dispense);
    d.run(700);
    const long target = d.target;
    CHECK(d.logic.request(Request::Prime) == Outcome::Rejected);
    CHECK(d.logic.request(Request::Calibrate) == Outcome::Rejected);
    CHECK(d.logic.request(Request::Jog, 23) == Outcome::Rejected);
    CHECK(d.logic.request(Request::MarkAligned) == Outcome::Rejected);
    CHECK(d.target == target && d.logic.state() == State::Running);
    d.settle();
    CHECK(d.logic.cycles() == 1 && d.moves.size() == 1);
  }

  // prime runs a cycle that is not counted as a dispense; a press during a prime is rejected, not queued
  {
    Device d(defaults(), true);
    CHECK(d.logic.request(Request::Prime) == Outcome::Started);
    d.run(100);
    CHECK(d.logic.request(Request::Dispense) == Outcome::Rejected);
    d.settle();
    CHECK(d.moves.size() == 1 && d.position == -4076 && d.logic.cycles() == 0 && d.logic.state() == State::Ready);
  }

  // calibration follows steps_per_turn: 4096 gives 4096-step cycles (2 cycles = 2 turns); with half-turn cycles, 4075 gives cycles that
  // round but never drift
  {
    Config c = defaults();
    c.steps_per_turn = 4096;
    Device d(c, true);
    CHECK(d.logic.request(Request::Calibrate) == Outcome::Started);
    d.settle();
    CHECK(d.moves.size() == 2 && d.position == -8192);
    for (long m : d.moves) CHECK(m == -4096);
    CHECK(d.logic.cycles() == 0);
  }
  {
    Config c = defaults();
    c.steps_per_turn = 4075;
    c.turns_per_cycle = 0.5;
    c.calibrate_cycles = 4;
    c.direction = 1;
    Device d(c, true);
    d.logic.request(Request::Calibrate);
    d.settle();
    CHECK(d.position == 8150);
    for (long m : d.moves) CHECK(m == 2037 || m == 2038);
    CHECK(d.logic.cycle_steps(0) + d.logic.cycle_steps(1) == 4075);
  }

  // a power cut at any moment of a cycle (before the first step, between the halves, in the settle, just after it): the device boots
  // unaligned unless the cycle had finished and committed its rest; booting "ready" with the rotor off its rest never happens
  {
    int unaligned = 0, ready = 0;
    for (uint32_t cut = 0; cut <= 7000; cut += 25) {
      Device d(defaults(), true);
      d.logic.request(Request::Dispense);
      d.run(cut);
      const bool finished = d.logic.state() == State::Ready;
      d.power_cycle();
      const bool at_rest = d.position % 4076 == 0;
      if (d.logic.state() == State::Ready) { ready++; CHECK(at_rest); CHECK(finished || d.position == 0); }
      else { unaligned++; CHECK(d.logic.state() == State::Unaligned); CHECK(d.logic.request(Request::Dispense) == Outcome::Rejected); }
    }
    CHECK(unaligned > 0 && ready > 0);
  }

  // the motor never reaches its target (the step generator overran): a fault, the cycle not counted, everything refused until a
  // reboot, which comes up unaligned
  {
    Device d(defaults(), true);
    d.stuck = true;
    d.logic.request(Request::Dispense);
    d.settle();
    CHECK(d.logic.state() == State::Fault && d.logic.cycles() == 0 && !d.committed);
    CHECK(d.logic.request(Request::Dispense) == Outcome::Rejected);
    CHECK(d.logic.request(Request::Jog, 23) == Outcome::Rejected);
    CHECK(d.logic.request(Request::MarkAligned) == Outcome::Rejected);
    d.power_cycle();
    CHECK(d.logic.state() == State::Unaligned);
  }

  // a configured rock (off for this dispenser): back first, the pause, then forward the cycle and the rock; it still lands on the cycle
  {
    Config c = defaults();
    c.rock_turns = 20.0 / 360.0;
    Device d(c, true);
    d.logic.request(Request::Dispense);
    d.settle();
    CHECK(d.moves.size() == 2 && d.moves[0] == 226 && d.moves[1] == -4302 && d.position == -4076);
    CHECK(d.move_times[1] - d.move_times[0] >= 226 * 1000 / 700 + c.pause_ms);
    CHECK(d.logic.cycles() == 1);
  }

  // a jog from ready leaves the rotor off its rest: it must be confirmed again
  {
    Device d(defaults(), true);
    d.logic.request(Request::Jog, 23);
    d.settle();
    CHECK(d.logic.state() == State::Unaligned && !d.committed);
    d.power_cycle();
    CHECK(d.logic.state() == State::Unaligned);
  }

  std::printf("%d checks, %d failures\n", checks, failures);
  return failures == 0 ? 0 : 1;
}
