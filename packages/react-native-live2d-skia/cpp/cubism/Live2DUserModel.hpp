#pragma once
#include <map>
#include <string>
#include <vector>
#include "CubismModelSettingJson.hpp"
#include "HeldParameterUpdater.hpp"
#include "Model/CubismUserModel.hpp"

namespace margelo::nitro::live2dskia {

namespace csm = Live2D::Cubism::Framework;

// Drives a model with the Cubism Framework, like the SDK sample's LAppModel,
// without its renderer: drawing is done with Skia from the drawable data.
// Never call CreateRenderer() on it (see CubismRendererStub.cpp).
// Not thread-safe: HybridLive2DModel serializes calls.
class Live2DUserModel : public csm::CubismUserModel {
    public:
        enum Priority { PriorityIdle = 1, PriorityNormal = 2, PriorityForce = 3 };

        // Throws std::runtime_error if the moc or the settings can't be loaded.
        Live2DUserModel(const uint8_t* moc, size_t mocSize, const std::string& settingsJson);
        ~Live2DUserModel() override;

        csm::CubismModel* model() const { return _model; }

        void loadPhysics(const std::string& json);
        void loadPose(const std::string& json);
        void loadMotion(const std::string& group, int index, const std::string& json);
        bool startMotion(const std::string& group, int index, Priority priority);
        bool startRandomMotion(const std::string& group, Priority priority);
        void stopMotion();
        bool isMotionPlaying();
        void loadExpression(const std::string& name, const std::string& json);
        bool setExpression(const std::string& name);
        bool setRandomExpression();
        void clearExpression();
        // Clamped to the parameter's range; ids the model doesn't have are ignored.
        void setParameter(const std::string& id, float value);
        void setParameters(const std::vector<std::string>& ids, const std::vector<double>& values);
        void clearParameter(const std::string& id);
        void clearParameters();
        // Time constant in seconds of the easing of held parameters towards their value, 0 for none.
        float parameterSmoothing() const { return _parameterSmoothing; }
        void setParameterSmoothing(float seconds) { _parameterSmoothing = seconds < 0 ? 0 : seconds; }
        // Whether a random Idle motion starts whenever no motion plays.
        bool idleMotionEnabled() const { return _idleMotionEnabled; }
        void setIdleMotionEnabled(bool enabled) { _idleMotionEnabled = enabled; }
        // -1..1 on each axis, y-up.
        void focus(float x, float y);
        // Hit area names containing the point (model units, y-up).
        std::vector<std::string> hitTest(float x, float y);
        void update(float deltaSeconds);

    private:
        static std::string motionKey(const std::string& group, int index);

        csm::CubismModelSettingJson* _setting = nullptr;
        csm::csmVector<csm::CubismIdHandle> _eyeBlinkIds;
        csm::csmVector<csm::CubismIdHandle> _lipSyncIds;
        std::map<std::string, csm::ACubismMotion*> _motions;
        std::map<std::string, csm::ACubismMotion*> _expressions;
        // Set by setParameter, applied every update.
        std::map<csm::CubismIdHandle, HeldParameter> _heldParameters;
        float _parameterSmoothing = 0;
        bool _idleMotionEnabled = true;
        // Read by the eye blink updater: no blinking while a motion moves the eyes.
        csm::csmBool _motionUpdated = false;
};

} // namespace margelo::nitro::live2dskia
