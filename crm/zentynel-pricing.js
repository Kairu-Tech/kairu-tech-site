/* Tarifa facilitada por KairuTech. Paquete completo por tramo, sin IVA. */
(function(root){
 'use strict';
 const tariff=Object.freeze({version:'zentynel-pvp-20261128-v1',currency:'EUR',billing:'full-package',annualBase:990,onboarding:400,tiers:Object.freeze([[10,10],[30,8],[50,7],[75,6],[100,5],[300,4],[500,3],[1000,2],[1500,1.5],[2000,1],[3000,0.8],[5000,0.7]].map(([limit,rate])=>Object.freeze({limit,rate})))});
 function calculate(users){
  const n=Number(users);if(String(users??'').trim()===''||!Number.isSafeInteger(n)||n<1)throw Error('Indica un número entero de usuarios mayor que cero.');
  const tier=tariff.tiers.find(t=>n<=t.limit);
  if(!tier)return {users:n,status:'outside-tariff',version:tariff.version,currency:'EUR',billing:tariff.billing,annual:null,firstYear:null};
  const userFee=Math.round(tier.limit*tier.rate*100)/100,annual=Math.round((tariff.annualBase+userFee)*100)/100;
  return {users:n,status:'calculated',version:tariff.version,currency:'EUR',billing:tariff.billing,packageUsers:tier.limit,rate:tier.rate,annualBase:tariff.annualBase,onboarding:tariff.onboarding,userFee,annual,firstYear:annual+tariff.onboarding};
 }
 root.zentynelPricing=Object.freeze({tariff,calculate});
})(window);
