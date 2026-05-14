/* Minimal research schema for the simulation backend. */

SET NAMES utf8mb4;
SET time_zone = "+00:00";
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS promo_redemptions;
DROP TABLE IF EXISTS promo_codes;
DROP TABLE IF EXISTS daily_token_usage;
DROP TABLE IF EXISTS daily_usage;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS simulation_token_usage;
DROP TABLE IF EXISTS simulation_chat_events;
DROP TABLE IF EXISTS research_steps;
DROP TABLE IF EXISTS research_sessions;
DROP TABLE IF EXISTS developer_suite_cases;
DROP TABLE IF EXISTS developer_suite_runs;
DROP TABLE IF EXISTS persona_set_personas;
DROP TABLE IF EXISTS persona_sets;
DROP TABLE IF EXISTS persona_library_records;
DROP TABLE IF EXISTS persona_lab_jobs;
DROP TABLE IF EXISTS guided_workflows;
DROP TABLE IF EXISTS memory_retrieval_logs;
DROP TABLE IF EXISTS memory_episodes;
DROP TABLE IF EXISTS memory_edges;
DROP TABLE IF EXISTS memory_nodes;
DROP TABLE IF EXISTS memory_scopes;
DROP TABLE IF EXISTS research_events;
DROP TABLE IF EXISTS simulation_events;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS simulations (
  simulation_id VARCHAR(36) PRIMARY KEY,
  status VARCHAR(24) NOT NULL DEFAULT 'running',
  user_context JSON NULL,
  final_metrics JSON NULL,
  summary TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simulation_checkpoints (
  simulation_id VARCHAR(36) PRIMARY KEY,
  checkpoint_json LONGTEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'running',
  last_error TEXT NULL,
  status_reason VARCHAR(32) NULL,
  current_phase_key VARCHAR(64) NULL,
  phase_progress_pct FLOAT NULL,
  event_seq BIGINT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_checkpoint_sim FOREIGN KEY (simulation_id)
    REFERENCES simulations(simulation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agents (
  agent_id VARCHAR(36) PRIMARY KEY,
  simulation_id VARCHAR(36) NOT NULL,
  short_id VARCHAR(8) NULL,
  category_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NULL,
  archetype_name VARCHAR(64) NULL,
  traits JSON NULL,
  biases JSON NULL,
  influence_weight FLOAT NULL,
  is_leader TINYINT(1) NULL,
  fixed_opinion VARCHAR(16) NULL,
  initial_opinion VARCHAR(16) NULL,
  current_opinion VARCHAR(16) NULL,
  last_phase VARCHAR(64) NULL,
  confidence FLOAT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agents_sim (simulation_id),
  INDEX idx_agents_short (short_id),
  CONSTRAINT fk_agents_sim FOREIGN KEY (simulation_id)
    REFERENCES simulations(simulation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reasoning_steps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  simulation_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  agent_short_id VARCHAR(8) NULL,
  agent_label VARCHAR(32) NULL,
  archetype_name VARCHAR(64) NULL,
  iteration INT NULL,
  phase VARCHAR(32) NULL,
  message TEXT NOT NULL,
  opinion VARCHAR(16) NULL,
  triggered_by VARCHAR(32) NULL,
  reply_to_agent_id VARCHAR(36) NULL,
  reply_to_short_id VARCHAR(8) NULL,
  opinion_source VARCHAR(24) NULL,
  stance_confidence FLOAT NULL,
  reasoning_length VARCHAR(16) NULL,
  fallback_reason VARCHAR(64) NULL,
  relevance_score FLOAT NULL,
  policy_guard TINYINT(1) NULL,
  policy_reason VARCHAR(128) NULL,
  stance_locked TINYINT(1) NULL,
  reason_tag VARCHAR(64) NULL,
  clarification_triggered TINYINT(1) NULL,
  step_uid VARCHAR(96) NULL,
  event_seq BIGINT NULL,
  stance_before VARCHAR(16) NULL,
  stance_after VARCHAR(16) NULL,
  evidence_keys JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_steps_sim (simulation_id),
  INDEX idx_steps_agent (agent_id),
  UNIQUE KEY uq_reasoning_step_uid (simulation_id, step_uid),
  CONSTRAINT fk_steps_sim FOREIGN KEY (simulation_id)
    REFERENCES simulations(simulation_id) ON DELETE CASCADE,
  CONSTRAINT fk_steps_agent FOREIGN KEY (agent_id)
    REFERENCES agents(agent_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS metrics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  simulation_id VARCHAR(36) NOT NULL,
  iteration INT NULL,
  accepted INT NULL,
  rejected INT NULL,
  neutral INT NULL,
  acceptance_rate FLOAT NULL,
  polarization FLOAT NULL,
  total_agents INT NULL,
  per_category JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_metrics_sim (simulation_id),
  CONSTRAINT fk_metrics_sim FOREIGN KEY (simulation_id)
    REFERENCES simulations(simulation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
