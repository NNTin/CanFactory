// V-HACD 4 (https://github.com/kmammou/v-hacd, BSD-3-Clause), compiled to WebAssembly by build.sh. Single-threaded: the browser
// runs one decomposition per Web Worker instead.
#define ENABLE_VHACD_IMPLEMENTATION 1
#define VHACD_DISABLE_THREADING 1
#include "VHACD.h"
#include "results.h"

extern "C" {
/**
 * params: max hulls, voxel resolution, minimum volume error (%), max recursion depth, max vertices per hull, shrink-wrap (0/1),
 * minimum edge length (voxels), find best plane (0/1). Returns the number of hulls, or -1.
 */
int decompose(const double *vertices, int vertex_count, const int32_t *triangles, int triangle_count, const double *params) {
  release();
  VHACD::IVHACD::Parameters p;
  p.m_maxConvexHulls = static_cast<uint32_t>(params[0]);
  p.m_resolution = static_cast<uint32_t>(params[1]);
  p.m_minimumVolumePercentErrorAllowed = params[2];
  p.m_maxRecursionDepth = static_cast<uint32_t>(params[3]);
  p.m_maxNumVerticesPerCH = static_cast<uint32_t>(params[4]);
  p.m_shrinkWrap = params[5] != 0;
  p.m_minEdgeLength = static_cast<uint32_t>(params[6]);
  p.m_findBestPlane = params[7] != 0;
  p.m_asyncACD = false;
  VHACD::IVHACD *vhacd = VHACD::CreateVHACD();
  bool ok = vhacd->Compute(vertices, static_cast<uint32_t>(vertex_count), reinterpret_cast<const uint32_t *>(triangles), static_cast<uint32_t>(triangle_count), p);
  if (ok) {
    for (uint32_t i = 0; i < vhacd->GetNConvexHulls(); i++) {
      VHACD::IVHACD::ConvexHull hull;
      vhacd->GetConvexHull(i, hull);
      Hull out;
      for (const auto &v : hull.m_points) { out.vertices.push_back(v.mX); out.vertices.push_back(v.mY); out.vertices.push_back(v.mZ); }
      for (const auto &t : hull.m_triangles) { out.triangles.push_back(t.mI0); out.triangles.push_back(t.mI1); out.triangles.push_back(t.mI2); }
      hulls.push_back(std::move(out));
    }
  }
  vhacd->Release();
  return ok ? hull_count() : -1;
}
}
