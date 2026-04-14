/* Taxonomies, domains, impact levels, domain-specific field definitions,
 * and people-management metric definitions.
 */
(function () {
  'use strict';

  const TAXONOMIES = {
    values: {
      key: 'values',
      label: 'Company Values',
      short: 'Values',
      items: ['Security', 'People', 'Innovation', 'Transparency']
    },
    tenets: {
      key: 'tenets',
      label: 'Culture Tenets',
      short: 'Tenets',
      items: ['Stronger Together', 'Own The Outcome', 'Lead The Way']
    },
    principles: {
      key: 'principles',
      label: 'Principles',
      short: 'Principles',
      items: [
        'Seek to Understand',
        'Foster Pack Unity',
        'Communicate with Candor',
        'Protect and Delight',
        'Be Accountable',
        'Security First',
        'Innovate to Advance',
        'Listen Learn Teach',
        'Speed and Quality'
      ]
    }
  };

  const TAXONOMY_KEYS = ['values', 'tenets', 'principles'];

  const DOMAINS = ['Operations', 'Project', 'People Management', 'Client Facing'];

  const IMPACT_LEVELS = ['Low', 'Medium', 'High', 'Critical'];
  const IMPACT_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 };
  const IMPACT_CLASS = {
    Low: 'impact-low',
    Medium: 'impact-medium',
    High: 'impact-high',
    Critical: 'impact-critical'
  };

  /* Domain-specific field enums.
   * Interaction types are split per-domain: People Management uses a
   * management-oriented set, Client Facing uses a customer/engagement-
   * oriented set. "Other" in either list reveals a free-text input. */
  const INTERACTION_TYPES_PEOPLE = [
    'One-on-One',
    'Skip Level',
    'Performance Coaching',
    'Project Meeting',
    'Other'
  ];
  const INTERACTION_TYPES_CLIENT = [
    'Escalation',
    'Prospective Customer',
    'Customer Event',
    'Day in the Life / SOC Tour',
    'Networking',
    'Executive Briefing',
    'Speaking or Presentation',
    'Quarterly Business Review',
    'Other'
  ];
  const MEETING_DIRECTIONS = ['I Called', 'They Called', 'Scheduled', 'Walk-In'];
  const SENTIMENTS = ['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative'];
  const DEVELOPMENT_THEMES = ['Career Growth', 'Skill Building', 'Performance', 'Engagement', 'Onboarding', 'Transition', 'Retention', 'Other'];
  const CUSTOMER_SENTIMENTS = ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'];

  /* People management monthly log metrics */
  const PEOPLE_METRICS = [
    { key: 'oneOnOnes',      label: 'One-on-Ones Conducted' },
    { key: 'coaching',       label: 'Coaching Moments Documented' },
    { key: 'conflicts',      label: 'Conflicts Identified & Resolved' },
    { key: 'capability',     label: 'Team Capability Development Actions' },
    { key: 'advocacy',       label: 'Advocacy Actions (Promotions, Recognition, Opportunities)' },
    { key: 'retention',      label: 'Retention Events (Departures, Offers Accepted, At-Risk)' },
    { key: 'performance',    label: 'Performance Management Actions Initiated' },
    { key: 'crossFunctional',label: 'Cross-Functional Influence Efforts' },
    { key: 'hiring',         label: 'Hiring Activities (Interviews, Offers, Decisions)' },
    { key: 'wins',           label: 'Notable Team / Culture Wins' }
  ];

  function emptyTags() {
    return { values: [], tenets: [], principles: [] };
  }

  function emptyPeopleLog(month) {
    const metrics = {};
    for (const m of PEOPLE_METRICS) {
      metrics[m.key] = { count: 0, notes: '' };
    }
    return { month, metrics };
  }

  /* Returns empty domain-specific fields object */
  function emptyDomainFields() {
    return {
      // People Management fields
      interactionType: '',
      interactionTypeOther: '',
      meetingDirection: '',
      individual: '',
      sentiment: '',
      developmentTheme: '',
      developmentThemeOther: '',
      followUpAction: '',
      followUpDescription: '',
      followUpTargetDate: '',
      followUpDismissed: false,
      // Client Facing fields
      companyName: '',
      customerSentiment: '',
      escalationNumber: '',
      escalationUrl: '',
      // Project fields
      projectNumber: '',
      projectUrl: ''
    };
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.tax = {
    TAXONOMIES,
    TAXONOMY_KEYS,
    DOMAINS,
    IMPACT_LEVELS,
    IMPACT_RANK,
    IMPACT_CLASS,
    INTERACTION_TYPES_PEOPLE,
    INTERACTION_TYPES_CLIENT,
    MEETING_DIRECTIONS,
    SENTIMENTS,
    DEVELOPMENT_THEMES,
    CUSTOMER_SENTIMENTS,
    PEOPLE_METRICS,
    emptyTags,
    emptyPeopleLog,
    emptyDomainFields
  };
})();
