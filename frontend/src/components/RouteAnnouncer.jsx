import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const routeNames = {
  '/dashboard': 'Dashboard',
  '/patients': 'Pacientes',
  '/research/projects': 'Projetos de pesquisa',
  '/forbidden': 'Acesso negado',
  '/login': 'Login',
};

function getRouteName(pathname) {
  if (pathname.startsWith('/patients/')) return 'Detalhes do paciente';
  if (pathname.startsWith('/research/projects/')) return 'Detalhes do projeto de pesquisa';
  return routeNames[pathname] || 'Página não encontrada';
}

export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const name = getRouteName(pathname);
    document.title = `${name} | HU Observability`;
    setAnnouncement(`Página carregada: ${name}`);
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname]);

  return <span className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</span>;
}
