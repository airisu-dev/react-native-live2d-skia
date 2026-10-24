#pragma once
#include "HybridLive2dSkiaSpec.hpp"

namespace margelo::nitro::live2dskia {
class HybridLive2dSkia : public HybridLive2dSkiaSpec {
    public:
        HybridLive2dSkia() : HybridObject(TAG), HybridLive2dSkiaSpec() {}

        std::shared_ptr<HybridLive2DModelSpec> loadModel(const std::shared_ptr<ArrayBuffer>& moc, const std::string& settingsJson) override;
    };
} // namespace margelo::nitro::live2dskia
