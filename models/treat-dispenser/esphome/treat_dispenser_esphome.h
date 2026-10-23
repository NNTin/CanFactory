// ESPHome glue for the treat dispenser's logic (treat_dispenser.h): the one instance, its "at rest" flag in flash, and the one
// entry point every button, action and the BOOT button go through. Included by treat-dispenser.yaml.
#pragma once

#include "esphome.h"
#include "treat_dispenser.h"

inline treat_dispenser::Logic *&dispenser() {
  static treat_dispenser::Logic *logic = nullptr;
  return logic;
}

inline esphome::ESPPreferenceObject &dispenser_rest_flag() {
  static esphome::ESPPreferenceObject flag;
  return flag;
}

/** A request from a button or an action: the logic accepts, queues or rejects it (the runner publishes the new state). */
inline void dispenser_submit(treat_dispenser::Request request, long steps = 0) {
  treat_dispenser::Logic *logic = dispenser();
  if (logic == nullptr) return;
  static const char *const requests[] = {"dispense", "prime", "calibrate", "jog", "mark aligned"};
  static const char *const outcomes[] = {"started", "queued", "done", "rejected"};
  const auto outcome = logic->request(request, steps);
  ESP_LOGI("dispenser", "%s: %s (%s)", requests[static_cast<int>(request)], outcomes[static_cast<int>(outcome)], logic->state_name());
}
