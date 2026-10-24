#if LIVE2D_SKIA

#include "MeshCache.hpp"
#include <chrono>
#include <cstring>

namespace margelo::nitro::live2dskia {

using namespace Live2D::Cubism::Core;

namespace {

double millisecondsSince(std::chrono::steady_clock::time_point start) {
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
}

} // namespace

void MeshCache::setTextureSizes(std::vector<SkISize> sizes) {
    _textureSizes = std::move(sizes);
    _meshes.clear();
}

void MeshCache::resize(size_t drawableCount) {
    if (_meshes.size() != drawableCount) _meshes.resize(drawableCount);
}

void MeshCache::resetStats() {
    _meshesBuilt = 0;
    _meshMs = 0;
}

const SkVertices* MeshCache::meshOf(const csmModel* model, int i, const CanvasInfo& info) {
    const int vertexCount = csmGetDrawableVertexCounts(model)[i];
    const int indexCount = csmGetDrawableIndexCounts(model)[i];
    const int texture = csmGetDrawableTextureIndices(model)[i];
    if (vertexCount == 0 || indexCount == 0 || texture < 0 ||
        texture >= static_cast<int>(_textureSizes.size())) {
        return nullptr;
    }
    Mesh& mesh = _meshes[i];
    const csmVector2* positions = csmGetDrawableVertexPositions(model)[i];
    if (mesh.vertices && mesh.positions.size() == static_cast<size_t>(vertexCount) &&
        std::memcmp(mesh.positions.data(), positions, vertexCount * sizeof(csmVector2)) == 0) {
        return mesh.vertices.get();
    }

    const auto start = std::chrono::steady_clock::now();
    if (mesh.texCoords.size() != static_cast<size_t>(vertexCount)) {
        const csmVector2* uvs = csmGetDrawableVertexUvs(model)[i];
        const SkISize size = _textureSizes[texture];
        mesh.texCoords.resize(vertexCount);
        for (int v = 0; v < vertexCount; ++v) {
            // Cubism UVs are v-up.
            mesh.texCoords[v] = {uvs[v].X * size.width(), (1 - uvs[v].Y) * size.height()};
        }
    }
    _points.resize(vertexCount);
    for (int v = 0; v < vertexCount; ++v) {
        // Cubism is y-up in model units; Skia is y-down in pixels.
        _points[v] = {info.originX + positions[v].X * info.pixelsPerUnit,
                      info.originY - positions[v].Y * info.pixelsPerUnit};
    }
    mesh.vertices = SkVertices::MakeCopy(SkVertices::kTriangles_VertexMode, vertexCount, _points.data(),
                                         mesh.texCoords.data(), nullptr, indexCount,
                                         csmGetDrawableIndices(model)[i]);
    mesh.positions.assign(positions, positions + vertexCount);
    _meshesBuilt++;
    _meshMs += millisecondsSince(start);
    return mesh.vertices.get();
}

} // namespace margelo::nitro::live2dskia

#endif // LIVE2D_SKIA
