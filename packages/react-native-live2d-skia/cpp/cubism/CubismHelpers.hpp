#pragma once
#include <stdexcept>
#include <string>
#include "CubismFramework.hpp"
#include "Id/CubismIdManager.hpp"
#include "Utils/CubismJson.hpp"

namespace margelo::nitro::live2dskia {

inline const Live2D::Cubism::Framework::csmByte* bytesOf(const std::string& s) {
    return reinterpret_cast<const Live2D::Cubism::Framework::csmByte*>(s.data());
}

// The Framework's loaders don't check for parse errors and crash on invalid
// JSON, so parse it once up front and throw instead.
inline void requireValidJson(const std::string& json, const std::string& what) {
    using namespace Live2D::Cubism::Framework;
    Utils::CubismJson* parsed = Utils::CubismJson::Create(bytesOf(json), static_cast<csmSizeInt>(json.size()));
    if (!parsed) throw std::runtime_error("Live2D: invalid " + what);
    Utils::CubismJson::Delete(parsed);
}

inline Live2D::Cubism::Framework::CubismIdHandle idOf(const Live2D::Cubism::Framework::csmChar* name) {
    return Live2D::Cubism::Framework::CubismFramework::GetIdManager()->GetId(name);
}

} // namespace margelo::nitro::live2dskia
