import Anthropic from '@anthropic-ai/sdk';

export type DsoEmailType = 'cpt-request' | 'opt-question' | 'stem-extension' | 'general-inquiry';

const EMAIL_TYPE_DESCRIPTIONS: Record<DsoEmailType, string> = {
  'cpt-request': 'requesting CPT authorization for an upcoming internship or job',
  'opt-question': 'asking a question about Optional Practical Training (OPT) eligibility or status',
  'stem-extension': 'requesting information or approval for a STEM OPT extension',
  'general-inquiry': 'a general F-1 compliance or visa status inquiry',
};

const SYSTEM_PROMPT = `You are a professional email writing assistant for F-1 international students.
Your task is to draft a clear, concise, and professional email from a student to their Designated School Official (DSO).

Rules:
1. Write in first person as the student.
2. Use a professional but approachable tone.
3. Be concise — no more than 200 words in the body.
4. Do NOT fabricate regulation citations, dates, or policy details not provided to you.
5. Do NOT include legal conclusions or say the student "is compliant" or "has the right to" anything.
6. Use this exact format:
   Subject: [clear subject line]

   Dear DSO,

   [body paragraphs]

   Thank you for your time and assistance.

   Sincerely,
   [Student Name]

7. End with a brief disclaimer line: "(This email was drafted with AI assistance and reviewed by the student.)"`;

export async function generateDsoEmail(
  emailType: DsoEmailType,
  profile: {
    fullName: string;
    programEndDate: string;
    degreeLevel: string;
    admissionDate: string;
    isStemEligible: boolean;
  },
  additionalContext?: string,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Please draft a professional email to my DSO for the following purpose: ${EMAIL_TYPE_DESCRIPTIONS[emailType]}.

My information:
- Name: ${profile.fullName}
- Degree level: ${profile.degreeLevel}
- Program end date: ${profile.programEndDate}
- I-20 admission date: ${profile.admissionDate}
- STEM-designated degree: ${profile.isStemEligible ? 'Yes' : 'No'}
${additionalContext ? `\nAdditional context from the student:\n${additionalContext}` : ''}

Draft the email now.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  return textBlocks.map(b => b.text).join('\n').trim();
}
