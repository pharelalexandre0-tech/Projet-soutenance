import JournalAudit from '../../components/JournalAudit';

// Journal d'audit de toute la plateforme, avec contrôle d'intégrité de la
// chaîne d'empreintes.
export default function AuditSecurite() {
  return <JournalAudit plateforme />;
}
