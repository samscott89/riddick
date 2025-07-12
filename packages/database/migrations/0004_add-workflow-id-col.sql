-- Migration number: 0004 	 2025-07-12T19:18:59.350Z
alter table "crates"
add column "workflow_id" TEXT default NULL;