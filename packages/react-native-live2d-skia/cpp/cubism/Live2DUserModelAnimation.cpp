// The loadable animation data of Live2DUserModel: physics, pose, motions and expressions.
#include "Live2DUserModel.hpp"
#include <cstdlib>
#include <iterator>
#include <stdexcept>
#include <vector>
#include "CubismHelpers.hpp"
#include "Motion/CubismMotion.hpp"
#include "Motion/CubismPhysicsUpdater.hpp"
#include "Motion/CubismPoseUpdater.hpp"

namespace margelo::nitro::live2dskia {

using namespace Live2D::Cubism::Framework;

void Live2DUserModel::loadPhysics(const std::string& json) {
    if (_physics) throw std::runtime_error("Live2D: physics already loaded");
    requireValidJson(json, "physics3.json");
    LoadPhysics(bytesOf(json), static_cast<csmSizeInt>(json.size()));
    if (!_physics) throw std::runtime_error("Live2D: invalid physics3.json");
    _updateScheduler.AddUpdatableList(CSM_NEW CubismPhysicsUpdater(*_physics));
    _updateScheduler.SortUpdatableList();
}

void Live2DUserModel::loadPose(const std::string& json) {
    if (_pose) throw std::runtime_error("Live2D: pose already loaded");
    requireValidJson(json, "pose3.json");
    LoadPose(bytesOf(json), static_cast<csmSizeInt>(json.size()));
    if (!_pose) throw std::runtime_error("Live2D: invalid pose3.json");
    _updateScheduler.AddUpdatableList(CSM_NEW CubismPoseUpdater(*_pose));
    _updateScheduler.SortUpdatableList();
}

void Live2DUserModel::loadMotion(const std::string& group, int index, const std::string& json) {
    const std::string key = motionKey(group, index);
    requireValidJson(json, "motion3.json for " + key);
    auto* motion = static_cast<CubismMotion*>(LoadMotion(
        bytesOf(json), static_cast<csmSizeInt>(json.size()), key.c_str(),
        nullptr, nullptr, _setting, group.c_str(), index));
    if (!motion) throw std::runtime_error("Live2D: invalid motion3.json for " + key);
    motion->SetEffectIds(_eyeBlinkIds, _lipSyncIds);

    auto it = _motions.find(key);
    if (it != _motions.end()) {
        _motionManager->StopAllMotions();
        ACubismMotion::Delete(it->second);
    }
    _motions[key] = motion;
}

bool Live2DUserModel::startMotion(const std::string& group, int index, Priority priority) {
    auto it = _motions.find(motionKey(group, index));
    if (it == _motions.end()) return false;

    if (priority == PriorityForce) {
        _motionManager->SetReservePriority(priority);
    } else if (!_motionManager->ReserveMotion(priority)) {
        return false;
    }
    // autoDelete = false: the motion is reused, and freed in the destructor.
    _motionManager->StartMotionPriority(it->second, false, priority);
    return true;
}

bool Live2DUserModel::startRandomMotion(const std::string& group, Priority priority) {
    int count = 0;
    while (_motions.count(motionKey(group, count))) ++count;
    if (count == 0) return false;
    return startMotion(group, std::rand() % count, priority);
}

void Live2DUserModel::stopMotion() {
    _motionManager->StopAllMotions();
}

bool Live2DUserModel::isMotionPlaying() {
    return !_motionManager->IsFinished();
}

void Live2DUserModel::resetPose(float fadeSeconds) {
    _motionManager->StopAllMotions();
    // Motions also switch pose parts (Hiyori's raised arm is PartArmB) through per-part values
    // that aren't model parameters. Reset puts back the first part of each group; restoring the
    // opacities it set lets the pose fade to that part instead of popping.
    if (_pose) {
        const csmInt32 partCount = _model->GetPartCount();
        std::vector<csmFloat32> opacities(static_cast<size_t>(partCount));
        for (csmInt32 i = 0; i < partCount; ++i) opacities[i] = _model->GetPartOpacity(i);
        _pose->Reset(_model);
        if (fadeSeconds > 0) {
            for (csmInt32 i = 0; i < partCount; ++i) _model->SetPartOpacity(i, opacities[i]);
        }
    }
    // update() starts each frame from the saved parameters, so a stopped motion alone
    // leaves the model frozen in its last pose: move those towards the defaults instead.
    if (fadeSeconds > 0) {
        _poseResetRemaining = fadeSeconds;
        return;
    }
    _poseResetRemaining = 0;
    for (csmInt32 i = 0; i < _model->GetParameterCount(); ++i) {
        _model->SetParameterValue(i, _model->GetParameterDefaultValue(i));
    }
    _model->SaveParameters();
}

void Live2DUserModel::easeToDefaultPose(float deltaSeconds) {
    // Linear in time: each frame covers its share of what is left, so it lands at the end.
    const float t = deltaSeconds >= _poseResetRemaining ? 1.0f : deltaSeconds / _poseResetRemaining;
    for (csmInt32 i = 0; i < _model->GetParameterCount(); ++i) {
        const float value = _model->GetParameterValue(i);
        _model->SetParameterValue(i, value + (_model->GetParameterDefaultValue(i) - value) * t);
    }
    _poseResetRemaining = t >= 1.0f ? 0 : _poseResetRemaining - deltaSeconds;
}

void Live2DUserModel::loadExpression(const std::string& name, const std::string& json) {
    requireValidJson(json, "exp3.json for " + name);
    ACubismMotion* expression = LoadExpression(bytesOf(json), static_cast<csmSizeInt>(json.size()), name.c_str());
    if (!expression) throw std::runtime_error("Live2D: invalid exp3.json for " + name);

    auto it = _expressions.find(name);
    if (it != _expressions.end()) {
        _expressionManager->StopAllMotions();
        ACubismMotion::Delete(it->second);
    }
    _expressions[name] = expression;
}

bool Live2DUserModel::setExpression(const std::string& name) {
    auto it = _expressions.find(name);
    if (it == _expressions.end()) return false;
    // autoDelete = false: the expression is reused, and freed in the destructor.
    _expressionManager->StartMotion(it->second, false);
    return true;
}

bool Live2DUserModel::setRandomExpression() {
    if (_expressions.empty()) return false;
    auto it = _expressions.begin();
    std::advance(it, std::rand() % _expressions.size());
    return setExpression(it->first);
}

void Live2DUserModel::clearExpression() {
    _expressionManager->StopAllMotions();
}

std::string Live2DUserModel::motionKey(const std::string& group, int index) {
    return group + "_" + std::to_string(index);
}

} // namespace margelo::nitro::live2dskia
