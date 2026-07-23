/**
 * Monday.com Integration Configuration
 * 
 * Column IDs auto-detected from the monday.com board.
 */

export const MONDAY_SECRETS = {
  API_TOKEN: 'MONDAY_API_TOKEN',
  BOARD_ID: 'MONDAY_BOARD_ID',
  GROUP_ID: 'MONDAY_GROUP_ID',
} as const;

export const MONDAY_COLUMN_IDS = {
  EMAIL: 'emailfs9p4vfw',
  DEPARTMENT: 'single_selecte24tng4',
  ISSUE_TYPE: 'single_selectsasiz69',
  IMPACT_URGENCY: 'single_selecthkab6xs',
  SHORT_SUMMARY: 'short_text8psrvpap',
  DETAILED_DESCRIPTION: 'long_textjd8dxlm9',
  AFFECTED_SYSTEM: 'single_selectsf0p7tv',
  ATTACHMENTS: 'filewl6l2ccm',
} as const;

// Department options matching monday.com board
export const DEPARTMENTS = [
  'Engineering',
  'Sales',
  'Marketing',
  'Finance',
  'HR',
  'Operations',
  'Customer Support',
  'Other',
] as const;

// Issue Type options matching monday.com board
export const ISSUE_CATEGORIES = [
  'Incident (something is broken)',
  'Service Request (access/software/hardware)',
  'Password/Account',
  'Network/Connectivity',
  'Email/Collaboration',
  'Hardware',
  'Software/Application',
  'Other',
] as const;

// Impact and Urgency options matching monday.com board
export const PRIORITY_OPTIONS = [
  'High impact & high urgency (critical outage or many users blocked)',
  'High impact or high urgency (major function degraded or deadline risk)',
  'Moderate (single user or workaround available)',
  'Low (minor issue or general inquiry)',
] as const;

// Affected System options matching monday.com board
export const AFFECTED_SYSTEMS = [
  'Laptop/Desktop',
  'Mobile Device',
  'Email (e.g., Outlook, Gmail)',
  'VPN/Remote Access',
  'Wi‑Fi/Network',
  'File Storage (e.g., OneDrive, SharePoint)',
  'Communication (e.g., Teams, Slack)',
  'Business App (specify in description)',
  'Other/Not sure',
] as const;

// Contact method options
export const CONTACT_METHODS = [
  'Email',
  'Phone',
  'Either',
] as const;

export type Department = typeof DEPARTMENTS[number];
export type IssueCategory = typeof ISSUE_CATEGORIES[number];
export type Priority = typeof PRIORITY_OPTIONS[number];
export type AffectedSystem = typeof AFFECTED_SYSTEMS[number];
export type ContactMethod = typeof CONTACT_METHODS[number];
