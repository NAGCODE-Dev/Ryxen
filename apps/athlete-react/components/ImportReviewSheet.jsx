import React from 'react';
import {
  MetricStrip,
  PrimaryAction,
  SecondaryAction,
  SectionCard,
  SheetModal,
} from '../../../packages/ui/index.js';

export default function ImportReviewSheet({
  open,
  review,
  reviewText,
  reviewTextDeferred,
  importState,
  onClose,
  onChangeReviewText,
  onReparse,
  onConfirm,
  onCancel,
}) {
  const days = Array.isArray(review?.days) ? review.days : [];
  const reviewLines = String(reviewTextDeferred || '').split('\n').filter(Boolean).length;

  return (
    <SheetModal
      open={open}
      title="Revisão ativa do plano"
      subtitle="Edite o texto que o parser vai interpretar antes de salvar. Isso ajuda muito quando OCR, cabeçalho ou nome do arquivo entram no meio do treino."
      onClose={onClose}
      footer={(
        <>
          <SecondaryAction onClick={onCancel} disabled={importState === 'saving'}>
            Cancelar
          </SecondaryAction>
          <PrimaryAction onClick={onConfirm} disabled={importState === 'saving'}>
            {importState === 'saving' ? 'Salvando...' : 'Salvar plano'}
          </PrimaryAction>
        </>
      )}
    >
      <MetricStrip
        metrics={[
          { label: 'Semanas', value: String(review?.weeksCount || 0).padStart(2, '0'), detail: review?.fileName || 'Arquivo atual' },
          { label: 'Dias', value: String(review?.totalDays || 0).padStart(2, '0'), detail: `${reviewLines} linhas revisadas` },
          { label: 'Blocos', value: String(review?.totalBlocks || 0).padStart(2, '0'), detail: review?.source || 'import' },
          { label: 'Preview', value: String(days.length).padStart(2, '0'), detail: 'dias resumidos abaixo' },
        ]}
      />

      <SectionCard
        eyebrow="Texto fonte"
        title="Revisão editorial do parser"
        subtitle="Se o OCR trouxe ruído, troque o texto cru aqui e mande reprocessar o preview."
        actions={(
          <SecondaryAction onClick={onReparse} disabled={!review?.canEditText || importState === 'reparsing'}>
            {importState === 'reparsing' ? 'Reprocessando...' : 'Reprocessar preview'}
          </SecondaryAction>
        )}
      >
        <label className="ath-reviewLabel" htmlFor="athlete-review-text">
          Texto revisável
        </label>
        <textarea
          id="athlete-review-text"
          className="ath-reviewTextarea"
          value={reviewText}
          onChange={(event) => onChangeReviewText(event.target.value)}
          spellCheck="false"
        />
      </SectionCard>

      <SectionCard eyebrow="Resumo" title="O que o preview entendeu">
        <div className="ath-reviewMetrics">
          {days.map((day) => (
            <article key={`${day.weekNumber}-${day.day}`} className="ath-reviewDay">
              <strong>{day.day}</strong>
              <span>Semana {day.weekNumber || '-'}</span>
              {day.blockTypes?.length ? <span>{day.blockTypes.join(' · ')}</span> : null}
              {day.goal ? <span>Objetivo: {day.goal}</span> : null}
              {day.movements?.length ? <span>{day.movements.join(', ')}</span> : null}
            </article>
          ))}
        </div>
      </SectionCard>
    </SheetModal>
  );
}
