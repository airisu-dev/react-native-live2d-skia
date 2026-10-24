#include <jni.h>
#include <fbjni/fbjni.h>
#include "Live2dSkiaOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::live2dskia::registerAllNatives();
  });
}