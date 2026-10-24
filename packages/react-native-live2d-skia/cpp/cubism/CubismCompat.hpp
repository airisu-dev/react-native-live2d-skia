#pragma once

// Differences between the Cubism SDK for Native versions react-native-live2d-skia builds
// against (cubismSdk.versions in package.json). build.gradle and the podspec
// pass the SDK's version as LIVE2D_SKIA_CUBISM_SDK: major * 10000 + release *
// 100 + patch, so 5-r.4.1 is 50401. Version-specific calls go here, behind
// #if on it (older SDK versions).

#include "Live2DCubismCore.hpp"

#ifndef LIVE2D_SKIA_CUBISM_SDK
#error "[react-native-live2d-skia] LIVE2D_SKIA_CUBISM_SDK isn't set: build through Gradle or CocoaPods."
#endif

#if LIVE2D_SKIA_CUBISM_SDK < 50500
#error "[react-native-live2d-skia] Cubism SDK for Native before 5-r.5 isn't supported."
#endif

namespace margelo::nitro::live2dskia::cubism {

// Drawable render orders. Named csmGetDrawableRenderOrders before 5-r.5.
inline const int* renderOrders(const Live2D::Cubism::Core::csmModel* model) {
    return Live2D::Cubism::Core::csmGetRenderOrders(model);
}

} // namespace margelo::nitro::live2dskia::cubism
