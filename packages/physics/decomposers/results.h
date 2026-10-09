// The shared C ABI of the decomposer shims (packages/physics/src/decompose.ts reads it): a call to `decompose` stores the convex
// hulls it found here, and the getters hand out pointers into this storage until the next call.
#pragma once
#include <cstdint>
#include <vector>

struct Hull {
  std::vector<double> vertices;   // x, y, z, ...
  std::vector<int32_t> triangles; // i, j, k, ...
};

static std::vector<Hull> hulls;

extern "C" {
int hull_count() { return static_cast<int>(hulls.size()); }
int hull_vertex_count(int i) { return static_cast<int>(hulls[i].vertices.size() / 3); }
const double *hull_vertices(int i) { return hulls[i].vertices.data(); }
int hull_triangle_count(int i) { return static_cast<int>(hulls[i].triangles.size() / 3); }
const int32_t *hull_triangles(int i) { return hulls[i].triangles.data(); }
void release() { hulls.clear(); hulls.shrink_to_fit(); }
}
