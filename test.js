import { extractPlacementConstraints } from './src/utils.js';

console.log('小児に配置', extractPlacementConstraints('小児に配置'));
console.log('急性、慢性には配置しない', extractPlacementConstraints('急性、慢性には配置しない'));
console.log('急性必須', extractPlacementConstraints('急性必須'));
console.log('精神不可', extractPlacementConstraints('精神不可'));
console.log('母性ＮＧ', extractPlacementConstraints('母性ＮＧ'));
