// CoACD (https://github.com/SarahWeiii/CoACD, MIT), compiled to WebAssembly by build.sh without its third-party libraries
// (OpenVDB's manifold preprocessing): the rendered parts are already closed manifolds. Single-threaded.
#include "coacd.h"
#include "results.h"

extern "C" {
/**
 * params: concavity threshold, max hulls (-1: no limit), sample resolution, MCTS nodes, MCTS iterations, MCTS max depth, PCA (0/1),
 * merge (0/1), decimate (0/1), max vertices per hull, seed. Returns the number of hulls, or -1.
 */
int decompose(const double *vertices, int vertex_count, const int32_t *triangles, int triangle_count, const double *params) {
  release();
  coacd::Mesh mesh;
  for (int i = 0; i < vertex_count; i++) mesh.vertices.push_back({vertices[3 * i], vertices[3 * i + 1], vertices[3 * i + 2]});
  for (int i = 0; i < triangle_count; i++) mesh.indices.push_back({triangles[3 * i], triangles[3 * i + 1], triangles[3 * i + 2]});
  coacd::set_log_level("off");
  std::vector<coacd::Mesh> parts = coacd::CoACD(mesh, params[0], static_cast<int>(params[1]), "off", 50, static_cast<int>(params[2]),
      static_cast<int>(params[3]), static_cast<int>(params[4]), static_cast<int>(params[5]), params[6] != 0, params[7] != 0,
      params[8] != 0, static_cast<int>(params[9]), false, 0.01, "ch", static_cast<unsigned int>(params[10]), false);
  for (const auto &part : parts) {
    Hull out;
    for (const auto &v : part.vertices) { out.vertices.push_back(v[0]); out.vertices.push_back(v[1]); out.vertices.push_back(v[2]); }
    for (const auto &t : part.indices) { out.triangles.push_back(t[0]); out.triangles.push_back(t[1]); out.triangles.push_back(t[2]); }
    hulls.push_back(std::move(out));
  }
  return hull_count();
}
}
