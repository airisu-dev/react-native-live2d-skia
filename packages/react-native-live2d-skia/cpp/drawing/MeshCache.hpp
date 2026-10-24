#pragma once
#if LIVE2D_SKIA

#include <vector>
#include "SkiaDrawer.hpp"
#include "include/core/SkPoint.h"
#include "include/core/SkRefCnt.h"
#include "include/core/SkSize.h"
#include "include/core/SkVertices.h"

namespace margelo::nitro::live2dskia {

// One Skia mesh per drawable, rebuilt only when the drawable's vertices moved.
class MeshCache {
    public:
        // Texture coordinates depend on the texture sizes, so this drops every mesh.
        void setTextureSizes(std::vector<SkISize> sizes);
        void resize(size_t drawableCount);
        void resetStats();

        // Returns the drawable's mesh, rebuilt if its vertices moved; null if it has none.
        const SkVertices* meshOf(const Live2D::Cubism::Core::csmModel* model, int i, const CanvasInfo& info);

        int meshesBuilt() const { return _meshesBuilt; }
        double meshMs() const { return _meshMs; }

    private:
        struct Mesh {
            sk_sp<SkVertices> vertices;
            // Model-space positions the mesh was built from, to detect changes.
            std::vector<Live2D::Cubism::Core::csmVector2> positions;
            // Texture coordinates in pixels, built once.
            std::vector<SkPoint> texCoords;
        };

        std::vector<SkISize> _textureSizes;
        std::vector<Mesh> _meshes;
        std::vector<SkPoint> _points; // scratch
        int _meshesBuilt = 0;
        double _meshMs = 0;
};

} // namespace margelo::nitro::live2dskia

#endif // LIVE2D_SKIA
