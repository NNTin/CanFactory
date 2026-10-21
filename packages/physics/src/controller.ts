/**
 * A firmware-like controller of one motor (contracts `PhysicsController`), stepped with the simulation: the same logic as the model's
 * ESPHome configuration, so that the simulated device behaves as the real one is meant to. One debounced press of the dispense button
 * runs one cycle; presses during a cycle wait in a bounded queue or are rejected (and counted); a reset stops the motor and reboots.
 *
 * It only commands motion. What it reports as a cycle is what the firmware knows: that it commanded one. Whether an item actually
 * left is what the spec's counter observed in the simulation, which the real device, having no sensor, cannot know.
 */
import type { PhysicsController } from '@canfactory/contracts';
import { DEG } from './scene.ts';
import type { Simulation } from './simulation.ts';

/**
 * booting: after a reset, presses are not seen; ready: waiting for a press; running: a cycle (or a prime, or a jog) is moving;
 * fault: a cycle lost more motor travel than allowed (stalled), until a reset; unaligned: a cycle was interrupted by a reset, so the
 * rotor's position is unknown, until it is jogged into line and confirmed aligned.
 */
export type ControllerState = 'booting' | 'ready' | 'running' | 'fault' | 'unaligned';

export interface CycleResult {
  /** 1, 2, ... in the order the cycles were commanded. */
  index: number;
  kind: 'dispense' | 'prime' | 'jog';
  /** Items the counter saw leave from the start of the cycle until it was reported done. */
  exits: number;
  /** Motor travel lost (slipped) in this cycle, degrees at the motor. */
  lost: number;
  /** Ended by a reset before it finished. */
  interrupted: boolean;
}

export interface ControllerReport {
  state: ControllerState;
  /** Dispense cycles the firmware completed (commanded), primes and jogs not included. */
  cycles: number;
  /** Presses rejected: during boot, a fault, while unaligned, or with the queue full. */
  rejected: number;
  /** Presses waiting. */
  queued: number;
  /** Items the counter has seen leave in all. */
  exits: number;
  /** Of those, items that left while no cycle was running (idle leakage). */
  idleExits: number;
  /** Motor travel lost in all, degrees. */
  lost: number;
  /** The motor's commanded and actual travel since the start, degrees. */
  commanded: number;
  actual: number;
  last?: CycleResult;
  message: string;
}

interface Button { down: boolean; since: number; fired: boolean }

export class CycleController {
  private state: ControllerState;
  private time = 0;
  private bootUntil = 0;
  private readonly buttons = new Map<string, Button>();
  private queue = 0;
  private rejected = 0;
  private cycles = 0;
  private index = 0;
  private idleExits = 0;
  private seen = 0;
  /** The cycle running: its kind, its moves and the next one, when the last stopped, and its start's counter and lost travel. */
  private run: { kind: CycleResult['kind']; moves: number[]; next: number; stopped: number | undefined; exits: number; lost: number; primesLeft: number } | undefined;
  private last: CycleResult | undefined;
  private message = 'Ready';
  private readonly start: number;

  constructor(private readonly simulation: Simulation, private readonly spec: PhysicsController) {
    this.state = 'ready';
    this.start = simulation.motor(spec.motor).commanded;
    simulation.addTicker(dt => { this.tick(dt); });
  }

  /** A button pressed (`down`) or let go. Its action fires once, after it has been held down for the debounce time. */
  press(control: string, down: boolean): void {
    if (!this.spec.controls.some(candidate => candidate.id === control)) throw new Error(`The controller has no control ${control}.`);
    const button = this.buttons.get(control) ?? { down: false, since: 0, fired: false };
    if (down && !button.down) { button.down = true; button.since = this.time; button.fired = false; }
    if (!down) button.down = false;
    this.buttons.set(control, button);
  }

  private exitsNow(): number { return this.simulation.counted(this.spec.counter).length; }
  private lostNow(): number { return Math.abs(this.simulation.motor(this.spec.motor).lost) / DEG; }

  private tick(dt: number): void {
    this.time += dt;
    for (const [id, button] of this.buttons) {
      if (button.down && !button.fired && this.time - button.since >= this.spec.debounce) { button.fired = true; this.act(id); }
    }
    if (this.state === 'booting' && this.time >= this.bootUntil) {
      this.state = this.last?.interrupted === true ? 'unaligned' : 'ready';
      this.message = this.state === 'unaligned' ? 'Rebooted after an interrupted cycle: jog the rotor into line, then confirm it is aligned' : 'Rebooted: ready, nothing moved';
    }
    const exits = this.exitsNow();
    if (exits > this.seen && !this.run) this.idleExits += exits - this.seen;
    this.seen = exits;
    if (this.run) this.advance();
  }

  private act(control: string): void {
    const action = this.spec.controls.find(candidate => candidate.id === control)?.action;
    if (action === 'reset') { this.reset(); return; }
    if (this.state === 'booting' || this.state === 'fault') { this.rejected++; return; }
    if (this.state === 'unaligned') {
      if (action === 'jog') this.begin('jog');
      else if (action === 'aligned') { this.state = 'ready'; this.message = 'Aligned: ready'; }
      else this.rejected++;
      return;
    }
    if (action === 'dispense') {
      if (this.run) { if (this.queue < this.spec.queue) this.queue++; else { this.rejected++; this.message = 'Busy: press rejected (queue full)'; } return; }
      this.begin('dispense');
    } else if (action === 'prime' && !this.run) this.begin('prime');
    else if (action === 'jog' && !this.run) this.begin('jog');
    else if (action !== 'aligned') this.rejected++;
  }

  private begin(kind: CycleResult['kind']): void {
    const moves = kind === 'jog' ? [this.spec.jog] : this.spec.moves;
    this.run = { kind, moves, next: 0, stopped: undefined, exits: this.exitsNow(), lost: this.lostNow(), primesLeft: kind === 'prime' ? this.spec.prime - 1 : 0 };
    this.state = 'running';
    this.message = kind === 'dispense' ? 'Dispensing: one cycle commanded' : kind === 'prime' ? 'Priming' : 'Jogging';
  }

  /**
   * Issues the cycle's moves in turn: each once the motor has stopped after the last and the pause has passed since; the cycle is done
   * the settle time after the last move stopped.
   */
  private advance(): void {
    const run = this.run;
    if (!run) return;
    if (run.next > 0) {
      if (this.simulation.motor(this.spec.motor).moving) { run.stopped = undefined; return; }
      run.stopped ??= this.time;
      if (this.lostNow() - run.lost > this.spec.stall) { this.finish(true); return; }
      if (this.time - run.stopped < (run.next < run.moves.length ? this.spec.pause : this.spec.settle)) return;
    }
    const move = run.moves[run.next];
    if (move === undefined) { this.finish(false); return; }
    this.simulation.moveMotor(this.spec.motor, move * DEG);
    run.next++;
    run.stopped = undefined;
  }

  private finish(stalled: boolean): void {
    const run = this.run;
    if (!run) return;
    this.index++;
    const result: CycleResult = { index: this.index, kind: run.kind, exits: this.exitsNow() - run.exits, lost: this.lostNow() - run.lost, interrupted: false };
    this.last = result;
    if (stalled) {
      this.run = undefined; this.queue = 0; this.state = 'fault';
      this.message = `Stalled: the motor lost ${result.lost.toFixed(1)}° — the firmware cannot detect this; reset`;
      return;
    }
    if (run.kind === 'prime' && run.primesLeft > 0) { this.begin('prime'); if (this.run) this.run.primesLeft = run.primesLeft - 1; return; }
    if (run.kind === 'dispense') this.cycles++;
    this.run = undefined;
    this.state = 'ready';
    this.message = run.kind === 'dispense' ? `Cycle ${this.cycles} commanded; ${result.exits} observed leaving` : run.kind === 'prime' ? 'Primed' : 'Jogged';
    if (this.queue > 0 && run.kind === 'dispense') { this.queue--; this.begin('dispense'); }
  }

  /** A reset: the motor stops where it is, the queue is dropped, and the device boots; nothing moves on boot. */
  private reset(): void {
    this.simulation.stopMotor(this.spec.motor);
    const interrupted = this.run !== undefined && this.run.kind !== 'jog';
    if (this.run) {
      this.index++;
      this.last = { index: this.index, kind: this.run.kind, exits: this.exitsNow() - this.run.exits, lost: this.lostNow() - this.run.lost, interrupted };
    }
    this.run = undefined;
    this.queue = 0;
    this.state = 'booting';
    this.bootUntil = this.time + this.spec.boot;
    this.message = 'Resetting';
    // a reset interrupting nothing does not leave the rotor unaligned, even after an earlier interrupted cycle was aligned
    if (!interrupted && this.last) this.last = { ...this.last, interrupted: false };
  }

  report(): ControllerReport {
    const motor = this.simulation.motor(this.spec.motor);
    return {
      state: this.state, cycles: this.cycles, rejected: this.rejected, queued: this.queue, exits: this.exitsNow(), idleExits: this.idleExits,
      lost: this.lostNow(), commanded: (motor.commanded - this.start) / DEG, actual: (motor.actual - this.start) / DEG,
      ...(this.last ? { last: this.last } : {}), message: this.message,
    };
  }
}
