ALTER TABLE organizations ADD COLUMN specialization varchar(80);
ALTER TABLE organizations ADD COLUMN services text;
ALTER TABLE organizations ADD COLUMN credentials text;
ALTER TABLE organizations ADD COLUMN portfolio text;
ALTER TABLE feasibility_requests ADD COLUMN property_information text;
ALTER TABLE feasibility_requests ADD COLUMN regulatory_information text;
UPDATE feasibility_requests SET status = 'MORE_INFORMATION_REQUIRED' WHERE status = 'NEEDS_INFORMATION';
UPDATE feasibility_requests SET status = 'ASSESSMENT_READY' WHERE status = 'ASSESSED';
ALTER TABLE feasibility_requests ADD CONSTRAINT feasibility_status_check CHECK (status IN ('DRAFT','SUBMITTED','IN_REVIEW','MORE_INFORMATION_REQUIRED','ASSESSMENT_READY','CLOSED'));
