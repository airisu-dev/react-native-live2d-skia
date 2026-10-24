#include "Live2DUserModel.hpp"
#include <stdexcept>
#include "CubismDefaultParameterId.hpp"
#include "CubismHelpers.hpp"
#include "Effect/CubismBreath.hpp"
#include "Effect/CubismEyeBlink.hpp"
#include "Effect/CubismLook.hpp"
#include "HeldParameterUpdater.hpp"
#include "Motion/CubismBreathUpdater.hpp"
#include "Motion/CubismExpressionUpdater.hpp"
#include "Motion/CubismEyeBlinkUpdater.hpp"
#include "Motion/CubismLookUpdater.hpp"

namespace margelo::nitro::live2dskia {

using namespace Live2D::Cubism::Framework;

Live2DUserModel::Live2DUserModel(const uint8_t* moc, size_t mocSize, const std::string& settingsJson) {
    if (moc == nullptr || mocSize == 0) {
        throw std::runtime_error("Live2D: moc is empty");
    }
    LoadModel(moc, static_cast<csmSizeInt>(mocSize), true);
    if (_model == nullptr) {
        throw std::runtime_error("Live2D: moc is invalid, corrupted or newer than this Cubism Core");
    }

    requireValidJson(settingsJson, "model3.json");
    _setting = CSM_NEW CubismModelSettingJson(bytesOf(settingsJson), static_cast<csmSizeInt>(settingsJson.size()));

    for (csmInt32 i = 0; i < _setting->GetEyeBlinkParameterCount(); ++i) {
        _eyeBlinkIds.PushBack(_setting->GetEyeBlinkParameterId(i));
    }
    for (csmInt32 i = 0; i < _setting->GetLipSyncParameterCount(); ++i) {
        _lipSyncIds.PushBack(_setting->GetLipSyncParameterId(i));
    }

    if (_eyeBlinkIds.GetSize() > 0) {
        _eyeBlink = CubismEyeBlink::Create(_setting);
        _updateScheduler.AddUpdatableList(CSM_NEW CubismEyeBlinkUpdater(_motionUpdated, *_eyeBlink));
    }

    _breath = CubismBreath::Create();
    csmVector<CubismBreath::BreathParameterData> breath;
    breath.PushBack(CubismBreath::BreathParameterData(idOf(DefaultParameterId::ParamAngleX), 0.0f, 15.0f, 6.5345f, 0.5f));
    breath.PushBack(CubismBreath::BreathParameterData(idOf(DefaultParameterId::ParamAngleY), 0.0f, 8.0f, 3.5345f, 0.5f));
    breath.PushBack(CubismBreath::BreathParameterData(idOf(DefaultParameterId::ParamAngleZ), 0.0f, 10.0f, 5.5345f, 0.5f));
    breath.PushBack(CubismBreath::BreathParameterData(idOf(DefaultParameterId::ParamBodyAngleX), 0.0f, 4.0f, 15.5345f, 0.5f));
    breath.PushBack(CubismBreath::BreathParameterData(idOf(DefaultParameterId::ParamBreath), 0.5f, 0.5f, 3.2345f, 0.5f));
    _breath->SetParameters(breath);
    _updateScheduler.AddUpdatableList(CSM_NEW CubismBreathUpdater(*_breath));

    _updateScheduler.AddUpdatableList(CSM_NEW CubismExpressionUpdater(*_expressionManager));

    _look = CubismLook::Create();
    csmVector<CubismLook::LookParameterData> look;
    look.PushBack(CubismLook::LookParameterData(idOf(DefaultParameterId::ParamAngleX), 30.0f));
    look.PushBack(CubismLook::LookParameterData(idOf(DefaultParameterId::ParamAngleY), 0.0f, 30.0f));
    look.PushBack(CubismLook::LookParameterData(idOf(DefaultParameterId::ParamAngleZ), 0.0f, 0.0f, -30.0f));
    look.PushBack(CubismLook::LookParameterData(idOf(DefaultParameterId::ParamBodyAngleX), 10.0f));
    look.PushBack(CubismLook::LookParameterData(idOf(DefaultParameterId::ParamEyeBallX), 1.0f));
    look.PushBack(CubismLook::LookParameterData(idOf(DefaultParameterId::ParamEyeBallY), 0.0f, 1.0f));
    _look->SetParameters(look);
    _updateScheduler.AddUpdatableList(CSM_NEW CubismLookUpdater(*_look, *_dragManager));

    _updateScheduler.AddUpdatableList(CSM_NEW HeldParameterUpdater(_heldParameters));

    _updateScheduler.SortUpdatableList();
    _model->SaveParameters();
}

Live2DUserModel::~Live2DUserModel() {
    // Stop motions before deleting them: the motion manager still points at them.
    if (_motionManager) _motionManager->StopAllMotions();
    for (auto& [_, motion] : _motions) {
        ACubismMotion::Delete(motion);
    }
    if (_expressionManager) _expressionManager->StopAllMotions();
    for (auto& [_, expression] : _expressions) {
        ACubismMotion::Delete(expression);
    }
    CSM_DELETE(_setting);
}

void Live2DUserModel::setParameter(const std::string& id, float value) {
    _heldParameters[idOf(id.c_str())] = value;
}

void Live2DUserModel::clearParameter(const std::string& id) {
    _heldParameters.erase(idOf(id.c_str()));
}

void Live2DUserModel::focus(float x, float y) {
    SetDragging(x, y);
}

std::vector<std::string> Live2DUserModel::hitTest(float x, float y) {
    std::vector<std::string> hits;
    // Like the SDK sample: a fading-in or transparent model can't be hit.
    if (_model->GetModelOpacity() < 1) return hits;
    for (csmInt32 i = 0; i < _setting->GetHitAreasCount(); ++i) {
        if (IsHit(_setting->GetHitAreaId(i), x, y)) {
            hits.emplace_back(_setting->GetHitAreaName(i));
        }
    }
    return hits;
}

void Live2DUserModel::update(float deltaSeconds) {
    // Same order as the SDK sample's LAppModel::Update.
    _motionUpdated = false;
    _model->LoadParameters();
    if (_motionManager->IsFinished()) {
        startRandomMotion("Idle", PriorityIdle);
    } else {
        _motionUpdated = _motionManager->UpdateMotion(_model, deltaSeconds);
    }
    _model->SaveParameters();

    // Eye blink (unless a motion moved the eyes), expression, look, breath,
    // held parameters, physics, pose.
    _updateScheduler.OnLateUpdate(_model, deltaSeconds);
    _model->Update();
}

} // namespace margelo::nitro::live2dskia
