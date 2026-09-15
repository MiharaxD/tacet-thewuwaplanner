export function registerPlannerTools({readPlan,startGoal,characters}){
 const context=document.modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
 register({name:'read_tacet_plan',title:'Consultar planejamento do Tacet',description:'Lê metas e materiais necessários, alocados e faltantes do planejamento local. Não altera estoque.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('A consulta não recebe parâmetros.');return readPlan();}});
 register({name:'start_tacet_goal',title:'Abrir configuração de meta',description:'Abre o formulário de meta de um personagem cadastrado. Não salva a meta nem consome recursos; a pessoa conclui o formulário.',inputSchema:{type:'object',properties:{characterId:{type:'string',enum:characters.map(c=>c.id)}},required:['characterId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(k=>k!=='characterId')||typeof input.characterId!=='string')throw Error('Personagem inválido.');return startGoal(input.characterId);}});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
