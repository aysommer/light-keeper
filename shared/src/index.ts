// Протокол
export { PROTOCOL_VERSION } from './protocol/ProtocolVersion.ts';
export { ProtocolGuard } from './protocol/HealthResponse.ts';
export type { HealthResponse } from './protocol/HealthResponse.ts';

// Конфигурация
export { GameConfig } from './config/GameConfig.ts';
export type { PlayerSettings, WorldSettings } from './config/GameConfig.ts';

// Математика и утилиты
export { Vector2 } from './math/Vector2.ts';
export { AABB } from './math/AABB.ts';
export { SeededRandom } from './random/SeededRandom.ts';
export { SeedHasher } from './random/SeedHasher.ts';
export { DisjointSet } from './util/DisjointSet.ts';

// Генерация мира
export { ChunkGenerator } from './generation/ChunkGenerator.ts';
export { WorldLayout } from './generation/WorldLayout.ts';
export { Chunk } from './generation/Chunk.ts';
export { ChunkGrid } from './generation/ChunkGrid.ts';
export { Room } from './generation/Room.ts';
export { Door } from './generation/Door.ts';
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

// Физика
export { CollisionResolver } from './physics/CollisionResolver.ts';
export { CollisionWorld } from './physics/CollisionWorld.ts';

// Навигация
export { OccupancyGrid, ReachableSet } from './navigation/OccupancyGrid.ts';
