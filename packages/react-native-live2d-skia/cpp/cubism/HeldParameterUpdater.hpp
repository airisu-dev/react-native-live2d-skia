#pragma once
#include <cmath>
#include <map>
#include "CubismModelSettingJson.hpp"
#include "Motion/ICubismUpdater.hpp"

namespace margelo::nitro::live2dskia {

// A parameter held at `target` by setParameter(s). `current` is what the model gets: the
// target, or eased towards it when smoothing is on.
struct HeldParameter {
    float target = 0;
    float current = 0;
    // Set until the first update after holding: `current` starts from the model's own value.
    bool fresh = true;
};

// Applies the held parameters every update, after look and breath (so they
// can be overridden) and before physics (so hair and clothes follow).
class HeldParameterUpdater : public Live2D::Cubism::Framework::ICubismUpdater {
    public:
        // `smoothing` is the time constant in seconds of the easing, 0 for none.
        HeldParameterUpdater(std::map<Live2D::Cubism::Framework::CubismIdHandle, HeldParameter>& values, const float& smoothing)
            : ICubismUpdater(Live2D::Cubism::Framework::CubismUpdateOrder_Breath + 50), _values(values), _smoothing(smoothing) {}

        void OnLateUpdate(Live2D::Cubism::Framework::CubismModel* model, Live2D::Cubism::Framework::csmFloat32 deltaSeconds) override {
            const float tau = _smoothing;
            for (auto& [id, held] : _values) {
                if (tau <= 0) {
                    held.current = held.target;
                } else {
                    if (held.fresh) held.current = model->GetParameterValue(id);
                    held.current += (held.target - held.current) * (1.0f - std::exp(-deltaSeconds / tau));
                }
                held.fresh = false;
                model->SetParameterValue(id, held.current);
            }
        }

    private:
        std::map<Live2D::Cubism::Framework::CubismIdHandle, HeldParameter>& _values;
        const float& _smoothing;
};

} // namespace margelo::nitro::live2dskia
