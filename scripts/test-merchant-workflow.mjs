import assert from 'node:assert/strict';
import { splitMerchantRequirements, isRestrictionRequirement } from '../src/merchant-workflow-rules.js';

assert.deepEqual(
  splitMerchantRequirements('必须出现门店地址\n- 突出招牌产品；突出店内环境\n必须出现门店地址', 10),
  ['必须出现门店地址', '突出招牌产品', '突出店内环境']
);
assert.deepEqual(splitMerchantRequirements('  \n；；', 16), []);
assert.deepEqual(splitMerchantRequirements('要求一；要求二；要求三', 2), ['要求一', '要求二']);
assert.equal(isRestrictionRequirement('不要出现其他品牌'), true);
assert.equal(isRestrictionRequirement('禁止使用未经授权的音乐'), true);
assert.equal(isRestrictionRequirement('重点突出招牌产品'), false);
console.log('商家需求拆解与禁止项规则测试通过');
