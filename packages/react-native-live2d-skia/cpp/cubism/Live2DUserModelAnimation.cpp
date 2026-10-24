// The loadable animation data of Live2DUserModel: physics, pose, motions and expressions.
#include "Live2DUserModel.hpp"
#include <cstdlib>
#include <iterator>
#include <stdexcept>
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
