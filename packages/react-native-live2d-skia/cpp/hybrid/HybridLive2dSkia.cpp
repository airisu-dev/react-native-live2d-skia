#include "HybridLive2dSkia.hpp"
#include "HybridLive2DModel.hpp"

namespace margelo::nitro::live2dskia {

std::shared_ptr<HybridLive2DModelSpec> HybridLive2dSkia::loadModel(const std::shared_ptr<ArrayBuffer>& moc, const std::string& settingsJson) {
    return std::make_shared<HybridLive2DModel>(moc->data(), moc->size(), settingsJson);
}

} // namespace margelo::nitro::live2dskia
