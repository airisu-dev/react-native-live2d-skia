#pragma once
#include <map>
#include "CubismModelSettingJson.hpp"
#include "Motion/ICubismUpdater.hpp"

namespace margelo::nitro::live2dskia {

// Applies setParameter values every update, after look and breath (so they
// can be overridden) and before physics (so hair and clothes follow).
class HeldParameterUpdater : public Live2D::Cubism::Framework::ICubismUpdater {
    public:
        explicit HeldParameterUpdater(const std::map<Live2D::Cubism::Framework::CubismIdHandle, float>& values)
            : ICubismUpdater(Live2D::Cubism::Framework::CubismUpdateOrder_Breath + 50), _values(values) {}

        void OnLateUpdate(Live2D::Cubism::Framework::CubismModel* model, Live2D::Cubism::Framework::csmFloat32) override {
            for (const auto& [id, value] : _values) {
                model->SetParameterValue(id, value);
            }
        }

    private:
        const std::map<Live2D::Cubism::Framework::CubismIdHandle, float>& _values;
};

} // namespace margelo::nitro::live2dskia
