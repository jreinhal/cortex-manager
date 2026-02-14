# Pricing, Support, and Deployment

This document outlines a proposed pricing model and support levels for CORTEX. Adjust values to match your commercial plans.

## Pricing model (proposed)
### Community (free)
- Self-hosted, local-first
- Core orchestration, knowledge base, and flight plans
- Community support only

### Team (per seat)
- Everything in Community
- Evaluation templates import/export
- Workspace management and RBAC controls
- Email support (business hours)

### Enterprise (custom)
- Everything in Team
- SSO and SCIM provisioning
- Dedicated onboarding and training
- Support SLAs and priority triage

## Support and SLAs (proposed)
| Tier | Response target | Channels |
| --- | --- | --- |
| Community | Best effort | GitHub issues |
| Team | 1 business day | Email |
| Enterprise | 4 business hours | Email + dedicated channel |

## Deployment requirements
Minimums:
- Node.js 18+
- 4 GB RAM (8 GB recommended)
- 500 MB for the app, plus space for reference repos

Recommended for local LLMs:
- SSD storage for model files
- 16 GB RAM or more for larger models
- GPU acceleration when supported by your inference server
