import { describe, it, expect } from "vitest";
import { measurementTemplates, measurementConfigSchema, measurementResponseSchema, validateMeasurementResponse } from "../shared/measurements";
const config = { model: "Jeep", module: "", standards: measurementTemplates.jeep.values, instructions: "" };
const response = { responsible: "Cliente teste", notes: "", answers: config.standards.map(cm=>({ choice: cm===null?"na" as const:"confirm" as const, cm })) };
describe("conferência do chicote",()=>{
 it("preserva as medidas dos três modelos e não soma margem ao Maverick",()=>{ expect(measurementTemplates.maverick.values[0]).toBe(60); for(const template of Object.values(measurementTemplates)) expect(template.values).toHaveLength(20); });
 it("usa o padrão do servidor ao confirmar e remove medidas em não se aplica",()=>{ const modified=structuredClone(response);modified.answers[0].cm=999;modified.answers[11].cm=999;const result=validateMeasurementResponse(config,modified);expect(result.answers[0].cm).toBe(60);expect(result.answers[11].cm).toBeNull(); });
 it("rejeita confirmação de trecho sem padrão",()=>{const modified=structuredClone(response);modified.answers[11].choice="confirm";expect(()=>validateMeasurementResponse(config,modified)).toThrow("Informe a medida");});
 it("rejeita personalização sem medida",()=>{expect(()=>validateMeasurementResponse(config,{...response,answers:response.answers.map((a,i)=>i===0?{choice:"change",cm:null}:a)})).toThrow("medida desejada");});
 it("exige os vinte trechos, nome e valores positivos",()=>{expect(measurementResponseSchema.safeParse({...response,answers:[]}).success).toBe(false);expect(measurementResponseSchema.safeParse({...response,responsible:""}).success).toBe(false);expect(measurementConfigSchema.safeParse({...config,standards:config.standards.map(()=>-1)}).success).toBe(false);});
});
