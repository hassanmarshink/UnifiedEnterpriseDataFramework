
CREATE TABLE metadata_GoalComment_1 (
  id BIGINT NOT NULL,
  commentator NCLOB,
  content NCLOB,
  lastModified DATE_TEXT,
  objId BIGINT,
  PRIMARY KEY(id)
);

