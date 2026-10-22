// The treat dispenser's firmware logic (CanFactory model treat-dispenser, docs/treat-dispenser.md), in plain C++17 so that the same
// code runs in ESPHome (treat-dispenser.yaml includes it) and in a host test (treat_dispenser_test.cpp, run by
// tools/esphome/treat-dispenser-firmware.test.ts). It mirrors the simulated controller (packages/physics/src/controller.ts).
//
// One runner owns the motor. Every request (dispense, prime, calibrate, jog, mark aligned) goes through request(), which accepts,
// queues or rejects it under one policy; poll() then issues the moves of the job that is running, one at a time, with the pauses
// between them, and starts the queued dispense when a job ends. Nothing else may move the motor.
//
// It knows only what it commands. It has no sensor: it cannot see a treat leave, a jam or where the disc really is, and a stalled
// 28BYJ-48 loses steps silently. A "cycle" here is a commanded motion that ran to its end, never an observed treat.
//
// Alignment is fail-safe: before any motion it persists "not at rest" and waits until that is committed (the caller's persist()
// must write synchronously); only after a cycle has run to its end does it persist "at rest" again. A device that boots without a
// committed "at rest" (first boot, power lost or RESET during any motion, or during the write that ends it) starts unaligned and
// accepts nothing but a jog and "mark aligned".
#pragma once

#include <cmath>
#include <cstdint>
#include <functional>

namespace treat_dispenser {

enum class State : uint8_t { Unaligned, Ready, Running, Fault };
enum class Job : uint8_t { None, Dispense, Prime, Calibrate, Jog };
enum class Request : uint8_t { Dispense, Prime, Calibrate, Jog, MarkAligned };
enum class Outcome : uint8_t { Started, Queued, Done, Rejected };

struct Config {
  /** Half-steps per turn of the motor's output shaft (CALIBRATE; nominally 4096, about 4076 for most 28BYJ-48s). */
  double steps_per_turn = 4076;
  /** Motor turns per dispense cycle: one notch pitch of the disc (a quarter turn) through the 15:30 gears = half a turn. */
  double turns_per_cycle = 0.5;
  /** +1 or −1, so that the disc turns the right way (VERIFY on the device). */
  int direction = -1;
  /** Half-steps per second and per second squared: how long a move may take before it is a fault. */
  double max_speed = 700, acceleration = 2000;
  /** The pause with the notch over the outlet, and the settle after a cycle before the next may start, ms. */
  uint32_t pause_ms = 300, settle_ms = 500;
  /** Cycles of a prime and of a calibration run. */
  int prime_cycles = 2, calibrate_cycles = 4;
  /** Dispense presses that may wait while a dispense runs. */
  int queue = 1;
};

struct Hooks {
  /** Start a relative move of the motor, in half-steps (already signed with the direction). */
  std::function<void(long)> move;
  /** Stop the motor where it is. */
  std::function<void()> stop;
  /** Persist whether the disc is at a rest position, and return only once it is committed to flash. */
  std::function<void(bool)> persist;
};

class Logic {
 public:
  Logic(Config config, Hooks hooks) : config_(config), hooks_(std::move(hooks)) {}

  /** At boot: `at_rest` is the committed flag from the last run. Nothing moves on boot. */
  void boot(bool at_rest) {
    job_ = Job::None; queued_ = 0; step_ = 0; moving_ = false;
    state_ = at_rest ? State::Ready : State::Unaligned;
    index_ = 0;
  }

  Outcome request(Request request, long jog_steps = 0) {
    switch (request) {
      case Request::Dispense:
        if (state_ == State::Running && job_ == Job::Dispense && queued_ < config_.queue) { queued_++; return Outcome::Queued; }
        if (state_ != State::Ready) return reject();
        start(Job::Dispense, 1);
        return Outcome::Started;
      case Request::Prime:
        if (state_ != State::Ready) return reject();
        start(Job::Prime, config_.prime_cycles);
        return Outcome::Started;
      case Request::Calibrate:
        if (state_ != State::Ready) return reject();
        start(Job::Calibrate, config_.calibrate_cycles);
        return Outcome::Started;
      case Request::Jog:
        // re-alignment: allowed when nothing runs and no fault is pending; afterwards the disc is off its rest until confirmed
        if (state_ != State::Ready && state_ != State::Unaligned) return reject();
        jog_ = jog_steps;
        start(Job::Jog, 1);
        return Outcome::Started;
      case Request::MarkAligned:
        if (state_ != State::Ready && state_ != State::Unaligned) return reject();
        hooks_.persist(true);
        state_ = State::Ready;
        index_ = 0;
        return Outcome::Done;
    }
    return reject();
  }

  /** Called often (every few ms): `now_ms` a monotonic clock, `motor_idle` whether the motor has reached its target. */
  void poll(uint32_t now_ms, bool motor_idle) {
    now_ = now_ms;
    if (state_ != State::Running) return;
    if (moving_) {
      if (!motor_idle) {
        if (now_ms - since_ > timeout_ms_) fault();
        return;
      }
      moving_ = false;
      since_ = now_ms;
    }
    // between moves: the pause after the first half, the settle after a cycle
    const bool cycle_end = step_ % 2 == 0;
    if (step_ > 0 && now_ms - since_ < (job_ == Job::Jog || cycle_end ? config_.settle_ms : config_.pause_ms)) return;
    if (job_ == Job::Jog) { if (step_ == 0) issue(config_.direction * jog_); else end(); return; }
    if (step_ > 0 && cycle_end) {
      // a cycle ran to its end: only now is it counted, and the disc is at rest again
      completed_++;
      if (job_ == Job::Dispense) cycles_++;
      if (completed_ == cycles_wanted_) { end(); return; }
    }
    // the next half of a cycle: to the cumulative rounded target, so that a non-integer cycle never drifts
    const double half = config_.steps_per_turn * config_.turns_per_cycle / 2;
    const long from = std::lround(half * static_cast<double>(2 * index_ + (step_ % 2)));
    const long to = std::lround(half * static_cast<double>(2 * index_ + (step_ % 2) + 1));
    if (step_ % 2 == 1) index_++;
    issue(config_.direction * (to - from));
  }

  /** RESET or power loss is a reboot: the caller calls boot() with the committed flag. This only stops the motor (e.g. a stop action). */
  void halt() { if (state_ == State::Running) { hooks_.stop(); fault(); } }

  State state() const { return state_; }
  Job job() const { return job_; }
  int queued() const { return queued_; }
  int cycles() const { return cycles_; }
  int rejected() const { return rejected_; }
  /** Half-steps of a full cycle starting at cycle `index` since alignment (for tests and the log). */
  long cycle_steps(long index) const {
    const double full = config_.steps_per_turn * config_.turns_per_cycle;
    return std::lround(full * static_cast<double>(index + 1)) - std::lround(full * static_cast<double>(index));
  }
  const char *state_name() const {
    switch (state_) {
      case State::Unaligned: return "needs re-alignment";
      case State::Ready: return "ready";
      case State::Running: return job_ == Job::Dispense ? "dispensing" : job_ == Job::Prime ? "priming" : job_ == Job::Calibrate ? "calibrating" : "jogging";
      case State::Fault: return "fault: reboot, then re-align";
    }
    return "?";
  }

 private:
  Outcome reject() { rejected_++; return Outcome::Rejected; }

  void start(Job job, int cycles) {
    // committed before the motor moves: a power cut from here on boots unaligned
    hooks_.persist(false);
    job_ = job; cycles_wanted_ = cycles; completed_ = 0; step_ = 0; moving_ = false; since_ = now_;
    state_ = State::Running;
  }

  void issue(long steps) {
    hooks_.move(steps);
    moving_ = true;
    since_ = now_;
    step_++;
    // a move may take twice its trapezoid's time, plus a second, before it is a fault (the step generator overran: not a jam)
    const double d = std::fabs(static_cast<double>(steps)), v = config_.max_speed, a = config_.acceleration;
    const double seconds = d < v * v / a ? 2 * std::sqrt(d / a) : d / v + v / a;
    timeout_ms_ = static_cast<uint32_t>(2000 * seconds) + 1000;
  }

  void end() {
    const Job job = job_;
    job_ = Job::None;
    if (job == Job::Jog) {
      // off its rest by a jog: needs "mark aligned"; "not at rest" stays committed
      state_ = State::Unaligned;
      queued_ = 0;
      return;
    }
    hooks_.persist(true);
    state_ = State::Ready;
    if (job == Job::Dispense && queued_ > 0) { queued_--; start(Job::Dispense, 1); }
  }

  void fault() {
    // "not at rest" stays committed, so the reboot this needs comes up unaligned
    job_ = Job::None; queued_ = 0; moving_ = false;
    state_ = State::Fault;
  }

  Config config_;
  Hooks hooks_;
  State state_ = State::Unaligned;
  Job job_ = Job::None;
  int queued_ = 0, cycles_ = 0, rejected_ = 0, cycles_wanted_ = 0, completed_ = 0, step_ = 0;
  long index_ = 0, jog_ = 0;
  bool moving_ = false;
  uint32_t now_ = 0, since_ = 0, timeout_ms_ = 0;
};

}  // namespace treat_dispenser
