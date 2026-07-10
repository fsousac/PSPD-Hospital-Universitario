import { Alert, AlertTitle, Stack } from '@mui/material';

export function ClinicalSafetyPanel({ accessLevel, events = [] }) {
  const criticalCount = events.filter((event) => event.critical === true).length;

  return (
    <Stack spacing={1.5} aria-label="Situação do registro clínico">
      {criticalCount > 0 ? (
        <Alert severity="error" variant="filled" role="alert">
          <AlertTitle>Resultado crítico sinalizado</AlertTitle>
          {criticalCount} registro(s) foram marcados como críticos pela fonte clínica. Confirme o dado no sistema assistencial oficial.
        </Alert>
      ) : (
        <Alert severity="info">
          Nenhum resultado foi marcado como crítico nos dados recebidos. Esta indicação não substitui avaliação clínica.
        </Alert>
      )}
      {accessLevel === 'PARTIAL' ? (
        <Alert severity="warning">
          <AlertTitle>Registro incompleto por nível de acesso</AlertTitle>
          Campos identificadores foram removidos ou reduzidos pelo backend. Não presuma que um campo ausente significa inexistência do dado.
        </Alert>
      ) : null}
    </Stack>
  );
}
