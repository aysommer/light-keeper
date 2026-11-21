// Протокол
export { PROTOCOL_VERSION } from './protocol/ProtocolVersion.ts';
export { ProtocolGuard } from './protocol/HealthResponse.ts';
export type { HealthResponse } from './protocol/HealthResponse.ts';
export { MessageCodec } from './protocol/MessageCodec.ts';
export { RecordRanking } from './protocol/Records.ts';
export type { RecordEntry, RecordsResponse } from './protocol/Records.ts';
export { LobbyCode } from './protocol/LobbyCode.ts';
export { PLAYER_COLORS } from './protocol/Messages.ts';
export type {
  ClientMessage,
  ClientMessageType,
  DebugGotoTarget,
  DroppedCanister,
  DebugLampPreset,
  ErrorCode,
  ExchangeSnapshot,
  ExitSnapshot,
  GhostSnapshot,
  LampSnapshot,
  LobbyPlayerInfo,
  LobbySnapshot,
  LobbyStatus,
  MatchPlayerInfo,
  MatchOverReason,
  MatchSnapshot,
  PlayerSnapshot,
  PlayerColor,
  ServerMessage,
  ServerMessageOf,
  ServerMessageType,
  SpacePhase,
} from './protocol/Messages.ts';

// Конфигурация
export { GameConfig } from './config/GameConfig.ts';
export type {
  CanisterSettings,
  ExchangeSettings,
  ExitSettings,
  GhostSettings,
  LampSettings,
  MatchSettings,
  PlayerSettings,
  WorldSettings,
} from './config/GameConfig.ts';

// Математика и утилиты
export { Vector2 } from './math/Vector2.ts';
export { AABB } from './math/AABB.ts';
export { SeededRandom } from './random/SeededRandom.ts';
export { SeedHasher } from './random/SeedHasher.ts';
export { DisjointSet } from './util/DisjointSet.ts';

// Генерация мира
export { SpaceGenerator } from './generation/SpaceGenerator.ts';
export { Space } from './generation/Space.ts';
export { SpaceGrid } from './generation/SpaceGrid.ts';
export { Room } from './generation/Room.ts';
export { Door } from './generation/Door.ts';
export { ExitDoor } from './generation/ExitDoor.ts';
export type { ExitKind } from './generation/ExitDoor.ts';
export { ExitCode } from './generation/ExitCode.ts';
export type { CodeAlphabet, CodeShape } from './generation/ExitCode.ts';
export { ExitPlanner } from './generation/ExitPlanner.ts';
export type { ExitPlan } from './generation/ExitPlanner.ts';
export { RoomGraph } from './generation/RoomGraph.ts';
export { Wall } from './generation/Wall.ts';
export { Obstacle } from './generation/Obstacle.ts';
export type { ObstacleKind } from './generation/Obstacle.ts';
export { GridEdge } from './generation/GridEdge.ts';
export type { EdgeOrientation } from './generation/GridEdge.ts';
export type { CellRect } from './generation/CellRect.ts';
export type { RoomKind } from './generation/RoomKind.ts';
export { RoomLayout } from './generation/RoomLayout.ts';
export { RoomLayoutPlanner } from './generation/RoomLayoutPlanner.ts';
export { DoorPlanner } from './generation/DoorPlanner.ts';
export type { PlannedDoor } from './generation/DoorPlanner.ts';
export { WallBuilder } from './generation/WallBuilder.ts';
export { RoomTemplate } from './generation/templates/RoomTemplate.ts';
export type { RoomDecoration, RoomDecorationContext } from './generation/templates/RoomTemplate.ts';
export { CorridorTemplate } from './generation/templates/CorridorTemplate.ts';
export { HallTemplate } from './generation/templates/HallTemplate.ts';
export { OfficeTemplate } from './generation/templates/OfficeTemplate.ts';
export { RoomTemplateRegistry } from './generation/templates/RoomTemplateRegistry.ts';

// Внешний вид
export { HslColor } from './appearance/HslColor.ts';
export { SpacePalette } from './appearance/SpacePalette.ts';
export type { WallpaperPattern } from './appearance/SpacePalette.ts';

// Физика
export { CollisionResolver } from './physics/CollisionResolver.ts';
export { CollisionWorld } from './physics/CollisionWorld.ts';

// Симуляция
export { PlayerMovement } from './simulation/PlayerMovement.ts';
export type { PlayerInput } from './simulation/PlayerInput.ts';
export { HELD_ITEMS } from './simulation/HeldItem.ts';
export { LampRules } from './simulation/LampRules.ts';
export { ExchangeRules } from './simulation/ExchangeRules.ts';
export { GhostRules } from './simulation/GhostRules.ts';
export type { LampLightState } from './simulation/LampRules.ts';
export type { HeldItem } from './simulation/HeldItem.ts';

// Навигация
export { OccupancyGrid, ReachableSet } from './navigation/OccupancyGrid.ts';
export { NavigationField } from './navigation/NavigationField.ts';
