
import { z } from 'zod';

export const GstinInputSchema = z.object({
  gstin: z.string().length(15, { message: "GSTIN must be 15 characters long." }).describe('The GSTIN of the business to look up.'),
});
export type GstinInput = z.infer<typeof GstinInputSchema>;

export const GstinOutputSchema = z.object({
  businessName: z.string().describe('The legal name of the business.'),
  businessAddress: z.string().describe('The principal address of the business.'),
});
export type GstinOutput = z.infer<typeof GstinOutputSchema>;
