const base = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconDashboard(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

export function IconUsers(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17.5" cy="9" r="2.3" />
      <path d="M15 19c.2-2.2 1.7-3.7 3.6-3.9" />
    </svg>
  );
}

export function IconPencil(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z" />
      <path d="M13 6.5 17.5 11" />
    </svg>
  );
}

export function IconKey(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12 19 4" />
      <path d="M15.5 7.5 18 10" />
      <path d="M18 4.5 20.5 7" />
    </svg>
  );
}

export function IconCalendarAlert(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="2.5" x2="8" y2="6.5" />
      <line x1="16" y1="2.5" x2="16" y2="6.5" />
      <line x1="12" y1="13" x2="12" y2="16" />
      <line x1="12" y1="17.6" x2="12" y2="17.61" />
    </svg>
  );
}

export function IconBrain(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="4.5" cy="6" r="1.6" />
      <circle cx="19.5" cy="6" r="1.6" />
      <circle cx="4.5" cy="18" r="1.6" />
      <circle cx="19.5" cy="18" r="1.6" />
      <line x1="6" y1="7.1" x2="10.3" y2="10.4" />
      <line x1="18" y1="7.1" x2="13.7" y2="10.4" />
      <line x1="6" y1="16.9" x2="10.3" y2="13.6" />
      <line x1="18" y1="16.9" x2="13.7" y2="13.6" />
    </svg>
  );
}

export function IconBell(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconBanknote(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <line x1="5.5" y1="9" x2="5.5" y2="9.01" />
      <line x1="18.5" y1="15" x2="18.5" y2="15.01" />
    </svg>
  );
}

export function IconCard(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
      <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" />
      <line x1="6" y1="14.5" x2="10.5" y2="14.5" />
    </svg>
  );
}

export function IconAlertTriangle(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 2 20.5h20L12 3.5Z" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconWallet(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 8.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H5.5a2 2 0 0 1 0-4H18" />
      <circle cx="16" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconDocument(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <line x1="8.5" y1="13" x2="15.5" y2="13" />
      <line x1="8.5" y1="16.5" x2="13" y2="16.5" />
    </svg>
  );
}

export function IconMessage(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16v10.5H9l-4.5 4V5.5Z" />
      <line x1="7.5" y1="9.5" x2="16.5" y2="9.5" />
      <line x1="7.5" y1="12.5" x2="13" y2="12.5" />
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <line x1="21" y1="12" x2="10.5" y2="12" />
      <path d="m16.5 7 5 5-5 5" />
    </svg>
  );
}

export function IconBuilding(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="3.5" width="10" height="17" rx="1" />
      <rect x="14.5" y="9.5" width="5" height="11" rx="1" />
      <line x1="7" y1="7" x2="7" y2="7.01" />
      <line x1="11.5" y1="7" x2="11.5" y2="7.01" />
      <line x1="7" y1="11" x2="7" y2="11.01" />
      <line x1="11.5" y1="11" x2="11.5" y2="11.01" />
      <line x1="7" y1="15" x2="7" y2="15.01" />
      <line x1="11.5" y1="15" x2="11.5" y2="15.01" />
    </svg>
  );
}

export function IconSettings(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 14l-1.7 1.7M17.7 17.7 16 16M8 10 6.3 8.3" />
    </svg>
  );
}

export function IconMenu(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  );
}
