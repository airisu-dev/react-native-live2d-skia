#pragma once
#if LIVE2D_SKIA

#include <jsi/jsi.h>
#include <memory>
#include <string>

namespace margelo::nitro::live2dskia {

namespace jsi = facebook::jsi;

// The wrapper behind a react-native-skia JS object. jsi's hasNativeState<T>
// uses dynamic_cast, which can't be relied on across shared libraries, so check
// for any native state and cast: only react-native-live2d-skia's own JS passes these in.
template <typename T>
std::shared_ptr<T> unwrap(jsi::Runtime& runtime, const jsi::Value& value, const char* what) {
    if (!value.isObject()) throw jsi::JSError(runtime, std::string("Live2D: expected ") + what);
    jsi::Object object = value.getObject(runtime);
    if (!object.hasNativeState(runtime)) throw jsi::JSError(runtime, std::string("Live2D: expected ") + what);
    return std::static_pointer_cast<T>(object.getNativeState(runtime));
}

} // namespace margelo::nitro::live2dskia

#endif // LIVE2D_SKIA
