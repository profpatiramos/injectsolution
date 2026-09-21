import { z } from "zod";
export const measureLabels = ["Furo → Módulo", "Furo → Central de Relés", "Furo → Central Original (Pós-chave)", "Furo → Positivo Bateria", "Furo → Negativo Bateria", "Furo → Bomba Combustível", "Furo → Centro da TBI", "Furo → Sensor Temperatura", "Furo → Sensor Rotação", "Furo → Sonda Lambda", "Furo → Bobina", "Bobina 1", "Bobina 2", "Bobina 3", "Bobina 4", "Sensor Pressão Combustível", "Sensor Pressão Óleo", "Positivo 50 Partida", "Tacômetro", "Conector Eletroventilador"];
export const measurementTemplates = {
  maverick: { name: "Maverick 4cc", values: [60,70,80,145,155,360,100,100,180,80,110,null,null,null,null,100,100,130,100,155] },
  jeep: { name: "Jeep 6cc", values: [60,25,70,40,60,350,70,65,140,80,75,null,null,null,null,null,null,null,null,null] },
  opala: { name: "Opala Turbo 4cc", values: [70,30,80,60,40,300,100,100,110,110,60,null,null,null,null,null,null,70,null,null] },
};
export const cmSchema = z.number().finite().positive().max(10000);
export const measurementConfigSchema = z.object({ model: z.string().trim().min(2).max(160), module: z.string().trim().max(160), standards: z.array(cmSchema.nullable()).length(20), instructions: z.string().trim().max(3000) });
export const answerSchema = z.object({ choice: z.enum(["confirm", "change", "na"]), cm: cmSchema.nullable() });
export const measurementResponseSchema = z.object({ answers: z.array(answerSchema).length(20), notes: z.string().trim().max(3000), responsible: z.string().trim().min(2).max(160) });
export type MeasurementConfig = z.infer<typeof measurementConfigSchema>;
export type MeasurementResponse = z.infer<typeof measurementResponseSchema>;
export function validateMeasurementResponse(config: MeasurementConfig, response: MeasurementResponse) {
  response.answers.forEach((answer, index) => {
    if (answer.choice === "confirm" && config.standards[index] === null) throw new Error(`Informe a medida ou marque não se aplica: ${measureLabels[index]}.`);
    if (answer.choice === "change" && answer.cm === null) throw new Error(`Informe a medida desejada: ${measureLabels[index]}.`);
  });
  return { ...response, answers: response.answers.map((answer, i) => ({ choice: answer.choice, cm: answer.choice === "confirm" ? config.standards[i] : answer.choice === "na" ? null : answer.cm })) };
}
