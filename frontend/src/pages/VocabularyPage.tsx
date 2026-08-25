import { BookmarkSimpleIcon, SpeakerHighIcon, TrashIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteFavoriteVocabulary, getFavoriteVocabularies } from '../services/vocabulary'

export default function VocabularyPage() {
  const queryClient = useQueryClient()
  const favoritesQuery = useQuery({ queryKey: ['vocabularies', 'favorites'], queryFn: getFavoriteVocabularies })
  const removeFavorite = useMutation({
    mutationFn: deleteFavoriteVocabulary,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vocabularies', 'favorites'] }),
  })
  const speak = (word: string, languageCode: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = languageCode === 'en' ? 'en-US' : languageCode === 'fr' ? 'fr-FR' : languageCode
    window.speechSynthesis.speak(utterance)
  }
  const saved = favoritesQuery.data ?? []

  return <div className="page"><section className="card vocab-head"><h1><BookmarkSimpleIcon weight="fill"/> 총 {saved.length}개의 단어</h1><div><button>⇩ 엑셀 다운로드</button><button className="primary" disabled={!saved.length}>✓ 퀴즈 시작하기</button></div></section>
    {favoritesQuery.isPending ? <div className="empty-state"><p>단어장을 불러오고 있어요.</p></div>
      : favoritesQuery.isError ? <div className="empty-state"><p>{favoritesQuery.error.message}</p><button className="primary" onClick={() => void favoritesQuery.refetch()}>다시 시도</button></div>
        : !saved.length ? <div className="empty-state vocabulary-empty"><BookmarkSimpleIcon/><h2>아직 저장한 단어가 없어요</h2><p>AI 문장 분석의 핵심 어휘에서 북마크를 누르면<br/>이곳에서 다시 학습할 수 있어요.</p></div>
          : <div className="word-grid">{saved.map(word => <article className="card word-card" key={word.favoriteId}><div className="word-title"><div><h2>{word.word}</h2>{word.cefrLevel && <span>{word.cefrLevel}</span>}<button aria-label={`${word.word} 발음 듣기`} onClick={() => speak(word.word, word.languageCode)}><SpeakerHighIcon/></button></div><button className="delete" disabled={removeFavorite.isPending && removeFavorite.variables === word.favoriteId} aria-label={`${word.word} 단어장에서 삭제`} onClick={() => removeFavorite.mutate(word.favoriteId)}><TrashIcon/></button></div><dl><dt>기본</dt><dd>{word.meaning}</dd>{word.contextMeaning && <><dt>문맥</dt><dd>{word.contextMeaning}</dd></>}</dl>{word.memoryTip && <p className="tip">💡 {word.memoryTip}</p>}{word.exampleSentence && <blockquote>{word.exampleSentence}</blockquote>}</article>)}</div>}
    {removeFavorite.isError && <p className="vocabulary-error" role="alert">{removeFavorite.error.message}</p>}
  </div>
}
