-- Add unique constraint on assessment_responses to enable upsert
ALTER TABLE public.assessment_responses 
ADD CONSTRAINT assessment_responses_assessment_question_unique 
UNIQUE (assessment_id, question_id);