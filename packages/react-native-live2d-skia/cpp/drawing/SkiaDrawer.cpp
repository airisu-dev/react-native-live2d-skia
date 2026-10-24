#if LIVE2D_SKIA

#include "SkiaDrawer.hpp"
#include "CubismCompat.hpp"
#include <algorithm>
#include <numeric>
#include "JsiSkCanvas.h"
#include "JsiSkShader.h"
#include "JsiUnwrap.hpp"
#include "MeshCache.hpp"
#include "include/core/SkCanvas.h"
#include "include/core/SkPaint.h"
#include "include/core/SkShader.h"
#include "include/core/SkVertices.h"

namespace margelo::nitro::live2dskia {

using namespace Live2D::Cubism::Core;

namespace {

SkBlendMode blendModeOf(csmFlags constantFlags) {
    if (constantFlags & csmBlendAdditive) return SkBlendMode::kPlus;
    if (constantFlags & csmBlendMultiplicative) return SkBlendMode::kMultiply;
    return SkBlendMode::kSrcOver;
}

} // namespace

struct SkiaDrawer::Impl {
    std::vector<sk_sp<SkShader>> shaders;
    MeshCache meshes;
    std::vector<int> order; // scratch
    SkPaint paint;
    SkPaint layerPaint;

    void drawMesh(SkCanvas* canvas, const SkVertices* vertices, int texture, SkPaint& p) {
        p.setShader(shaders[texture]);
        // No per-vertex colors, so the vertex blend mode is unused; the shader alone colors the mesh.
        canvas->drawVertices(vertices, SkBlendMode::kDst, p);
    }
};

SkiaDrawer::SkiaDrawer() : _impl(std::make_unique<Impl>()) {
    _impl->paint.setAntiAlias(true);
}

SkiaDrawer::~SkiaDrawer() = default;

void SkiaDrawer::setTextures(jsi::Runtime& runtime, const jsi::Value& shaders, const jsi::Value& sizes) {
    jsi::Array shaderArray = shaders.asObject(runtime).asArray(runtime);
    jsi::Array sizeArray = sizes.asObject(runtime).asArray(runtime);
    const size_t count = shaderArray.size(runtime);
    if (sizeArray.size(runtime) != count * 2) {
        throw jsi::JSError(runtime, "Live2D: expected a width and height per texture");
    }
    _impl->shaders.clear();
    std::vector<SkISize> textureSizes;
    for (size_t i = 0; i < count; ++i) {
        auto shader = unwrap<RNSkia::JsiSkShader>(runtime, shaderArray.getValueAtIndex(runtime, i), "an SkShader");
        _impl->shaders.push_back(shader->getObject());
        textureSizes.push_back(SkISize::Make(
            static_cast<int>(sizeArray.getValueAtIndex(runtime, i * 2).asNumber()),
            static_cast<int>(sizeArray.getValueAtIndex(runtime, i * 2 + 1).asNumber())));
    }
    _impl->meshes.setTextureSizes(std::move(textureSizes));
}

jsi::Value SkiaDrawer::draw(jsi::Runtime& runtime, const jsi::Value& canvasValue, bool wantStats,
                            const csmModel* model, const CanvasInfo& info) {
    if (_impl->shaders.empty()) throw jsi::JSError(runtime, "Live2D: call setTextures before draw");
    SkCanvas* canvas = unwrap<RNSkia::JsiSkCanvas>(runtime, canvasValue, "an SkCanvas")->getCanvas();
    Impl& d = *_impl;

    const int count = csmGetDrawableCount(model);
    d.meshes.resize(count);
    d.meshes.resetStats();
    int layers = 0;

    const int* renderOrders = cubism::renderOrders(model);
    const csmFlags* dynamicFlags = csmGetDrawableDynamicFlags(model);
    const csmFlags* constantFlags = csmGetDrawableConstantFlags(model);
    const int* textureIndices = csmGetDrawableTextureIndices(model);
    const float* opacities = csmGetDrawableOpacities(model);
    const int* maskCounts = csmGetDrawableMaskCounts(model);
    const int** masks = csmGetDrawableMasks(model);

    // Draw order: drawable indices sorted by render order.
    std::vector<int>& order = d.order;
    order.resize(count);
    std::iota(order.begin(), order.end(), 0);
    std::sort(order.begin(), order.end(), [&](int a, int b) { return renderOrders[a] < renderOrders[b]; });

    for (int i : order) {
        if (!(dynamicFlags[i] & csmIsVisible) || opacities[i] <= 0) continue;
        const SkVertices* vertices = d.meshes.meshOf(model, i, info);
        if (!vertices) continue;

        if (maskCounts[i] == 0) {
            d.paint.setAlphaf(opacities[i]);
            d.paint.setBlendMode(blendModeOf(constantFlags[i]));
            d.drawMesh(canvas, vertices, textureIndices[i], d.paint);
            continue;
        }

        // Draw into a layer, cut it with the union of the masks, then composite
        // the layer with the drawable's blend mode.
        const SkRect& bounds = vertices->bounds();
        d.layerPaint.setBlendMode(blendModeOf(constantFlags[i]));
        canvas->saveLayer(&bounds, &d.layerPaint);
        d.paint.setAlphaf(opacities[i]);
        d.paint.setBlendMode(SkBlendMode::kSrcOver);
        d.drawMesh(canvas, vertices, textureIndices[i], d.paint);

        d.layerPaint.setBlendMode((constantFlags[i] & csmIsInvertedMask) ? SkBlendMode::kDstOut : SkBlendMode::kDstIn);
        canvas->saveLayer(&bounds, &d.layerPaint);
        d.paint.setAlphaf(1);
        for (int m = 0; m < maskCounts[i]; ++m) {
            const int maskIndex = masks[i][m];
            const SkVertices* maskVertices = d.meshes.meshOf(model, maskIndex, info);
            if (maskVertices) d.drawMesh(canvas, maskVertices, textureIndices[maskIndex], d.paint);
        }
        canvas->restore();
        canvas->restore();
        layers += 2;
    }

    if (!wantStats) return jsi::Value::undefined();
    jsi::Object stats(runtime);
    stats.setProperty(runtime, "meshesBuilt", d.meshes.meshesBuilt());
    stats.setProperty(runtime, "layers", layers);
    stats.setProperty(runtime, "meshMs", d.meshes.meshMs());
    return stats;
}

} // namespace margelo::nitro::live2dskia

#endif // LIVE2D_SKIA
