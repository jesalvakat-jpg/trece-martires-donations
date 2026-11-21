-- Teacher's name change: Jocelyn H. Zamora is now Jocelyn H. Balasta.
-- Her class keeps its section name (Grade 6 – Zamora).
UPDATE staff         SET name        = 'Jocelyn H. Balasta' WHERE name        = 'Jocelyn H. Zamora';
UPDATE accounts      SET full_name   = 'Jocelyn H. Balasta' WHERE full_name   = 'Jocelyn H. Zamora';
UPDATE contributions SET received_by = 'Jocelyn H. Balasta' WHERE received_by = 'Jocelyn H. Zamora';
UPDATE contributions SET recorded_by = 'Jocelyn H. Balasta' WHERE recorded_by = 'Jocelyn H. Zamora';
