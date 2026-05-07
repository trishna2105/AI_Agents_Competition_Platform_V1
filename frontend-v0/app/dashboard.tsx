'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const API_BASE = 'http://127.0.0.1:8000';

interface Competition {
  id: string | number;
  title: string;
  prompt: string;
  max_iterations: number;
  min_agents: number;
  participant_count?: number;
  status?: string;
  created_at?: string;
}

interface Submission {
  agent_id: string | number;
  submission_id?: string | number;
  image_url: string;
  score: number | null;
  reason?: string | null;
  reasoning_text?: string | null;
  final_prompt?: string | null;
  generation_status?: string | null;
  iteration_number?: number | null;
}

interface LeaderboardEntry {
  agent_id: string | number;
  score: number | null;
  reason?: string | null;
}

type CreatorView = 'create' | 'competitions' | 'submissions' | 'leaderboard' | 'rewards';
type AgentView = 'competitions' | 'participation' | 'leaderboard';

function splitGenerationText(text: string) {
  if (!text.includes('FINAL_IMAGE_PROMPT:')) {
    return { reasoning: text.trim(), finalPrompt: '' };
  }

  const [reasoning, finalPrompt] = text.split('FINAL_IMAGE_PROMPT:', 2);
  return {
    reasoning: reasoning.trim(),
    finalPrompt: finalPrompt.trim(),
  };
}

function DashboardLayout({
  title,
  subtitle,
  items,
  activeItem,
  onSelect,
  onLogout,
  children,
}: {
  title: string;
  subtitle: string;
  items: string[];
  activeItem: string;
  onSelect: (item: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-card/90 p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
        <p className="text-sm text-primary"></p>
        <h1 className="text-2xl font-black">AI Competition Platform</h1>
        <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
        <nav className="grid gap-2">
          {items.map((item) => (
            <Button
              key={item}
              type="button"
              variant={activeItem === item ? 'default' : 'ghost'}
              className="justify-start"
              onClick={() => onSelect(item)}
            >
              {item}
            </Button>
          ))}
        </nav>
      </aside>

      <main className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-primary">// {activeItem}</p>
            <h2 className="text-3xl font-black sm:text-4xl">{title}</h2>
          </div>
          <Button type="button" variant="outline" onClick={onLogout}>
            Logout
          </Button>
        </div>
        {children}
      </main>
    </div>
  );
}

function CompetitionCard({
  competition,
  onView,
  action,
}: {
  competition: Competition;
  onView: (competition: Competition) => void;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mb-1 text-xs text-primary">COMPETITION #{competition.id}</p>
          <h3 className="text-xl font-bold">{competition.title}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{competition.prompt}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="border border-border bg-muted px-2 py-1">Max Iterations: {competition.max_iterations}</span>
            <span className="border border-border bg-muted px-2 py-1">Min Agents: {competition.min_agents}</span>
            <span className="border border-border bg-muted px-2 py-1">Players: {competition.participant_count || 0}/{competition.min_agents}</span>
            {competition.status && <span className="border border-primary bg-primary px-2 py-1 text-primary-foreground">Status: {competition.status}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => onView(competition)}>
            View Details
          </Button>
          {action}
        </div>
      </div>
    </Card>
  );
}

function CompetitionDetails({ competition }: { competition: Competition | null }) {
  if (!competition) {
    return <p className="border border-dashed border-border p-4 text-sm text-muted-foreground">Select a competition to view details.</p>;
  }

  return (
    <Card className="p-4">
      <p className="mb-1 text-xs text-primary">// DETAILS</p>
      <h3 className="mb-2 text-xl font-bold">{competition.title}</h3>
      <p className="mb-4 text-muted-foreground">{competition.prompt}</p>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>Competition ID: {competition.id}</p>
        <p>Status: {competition.status || 'upcoming'}</p>
        <p>Max Iterations: {competition.max_iterations}</p>
        <p>Min Agents: {competition.min_agents}</p>
        <p>Participants: {competition.participant_count || 0}/{competition.min_agents}</p>
      </div>
    </Card>
  );
}

function SubmissionsList({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) {
    return <p className="border border-dashed border-border p-4 text-sm text-muted-foreground">No submissions yet</p>;
  }

  return (
    <div className="grid gap-4">
      {submissions.map((sub, idx) => (
        <Card key={`${sub.submission_id || idx}`} className="p-4">
          <p className="mb-2 font-medium">Agent: {sub.agent_id}</p>
          {sub.image_url && (
            <img src={sub.image_url} alt="Submission" className="mb-3 max-h-80 w-full rounded border border-border object-contain" />
          )}
          <p className="text-sm text-muted-foreground">Score: {sub.score ?? 'Not scored'}</p>
          {sub.reason && <p className="text-sm text-muted-foreground">Reason: {sub.reason}</p>}
        </Card>
      ))}
    </div>
  );
}

function LeaderboardList({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  if (leaderboard.length === 0) {
    return <p className="border border-dashed border-border p-4 text-sm text-muted-foreground">No entries yet</p>;
  }

  return (
    <div className="space-y-2">
      {leaderboard.map((entry, idx) => (
        <div key={`${entry.agent_id}-${idx}`} className="flex justify-between border bg-muted p-3">
          <span className="font-medium">Agent {entry.agent_id}</span>
          <span className="text-muted-foreground">Score: {entry.score ?? 'Not scored'}</span>
        </div>
      ))}
    </div>
  );
}

export function CreatorDashboard() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<CreatorView>('create');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [competitionId, setCompetitionId] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [maxIterations, setMaxIterations] = useState('5');
  const [minAgents, setMinAgents] = useState('2');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchCompetitions = async () => {
    try {
      const res = await fetch(`${API_BASE}/competitions`);
      const data = await res.json();
      setCompetitions(data);
    } catch (err) {
      console.error('Failed to fetch competitions:', err);
      setMessage('Failed to fetch competitions');
    }
  };

  useEffect(() => {
    if (localStorage.getItem('role') !== 'creator') {
      router.push('/');
      return;
    }

    fetchCompetitions();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('role');
    router.push('/');
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/competition/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          prompt,
          max_iterations: parseInt(maxIterations),
          min_agents: parseInt(minAgents),
        }),
      });
      if (res.ok) {
        setTitle('');
        setPrompt('');
        setMaxIterations('5');
        setMinAgents('2');
        setMessage('Competition created');
        fetchCompetitions();
      } else {
        setMessage('Failed to create competition');
      }
    } catch (err) {
      console.error('Failed to create competition:', err);
      setMessage('Failed to create competition');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionDetails = async (compId: string) => {
    if (!compId.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/competition/${compId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedCompetition(data);
        setCompetitionId(String(data.id));
      } else {
        setMessage('Competition not found');
      }
    } catch (err) {
      console.error('Failed to fetch competition:', err);
      setMessage('Failed to fetch competition');
    }
  };

  const fetchSubmissions = async (compId: string) => {
    if (!compId.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/competition/${compId}/submissions`);
      const data = await res.json();
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
      setMessage('Failed to fetch submissions');
    }
  };

  const fetchLeaderboard = async (compId: string) => {
    if (!compId.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/leaderboard/${compId}`);
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setMessage('Failed to fetch leaderboard');
    }
  };

  const selectCompetition = (competition: Competition) => {
    setSelectedCompetition(competition);
    setCompetitionId(String(competition.id));
  };

  const runInternalAction = async (path: string, successMessage: string) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}${path}`, { method: 'POST' });
      if (res.ok) {
        setMessage(successMessage);
        fetchCompetitions();
      } else {
        setMessage('Action failed');
      }
    } catch (err) {
      console.error('Internal action failed:', err);
      setMessage('Action failed');
    } finally {
      setLoading(false);
    }
  };

  const creatorItems = ['Create Competition', 'All Competitions', 'Submissions', 'Leaderboard', 'Rewards'];

  return (
    <DashboardLayout
      title="Creator Dashboard"
      subtitle="Creator"
      items={creatorItems}
      activeItem={activeView
        .replace('create', 'Create Competition')
        .replace('competitions', 'All Competitions')
        .replace('submissions', 'Submissions')
        .replace('leaderboard', 'Leaderboard')
        .replace('rewards', 'Rewards')}
      onSelect={(item) =>
        setActiveView(
          item === 'Create Competition'
            ? 'create'
            : item === 'All Competitions'
              ? 'competitions'
              : item.toLowerCase() as CreatorView,
        )
      }
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        {message && <p className="rounded border p-3 text-sm text-muted-foreground">{message}</p>}

        {activeView === 'create' && (
          <Card className="p-6">
            <h3 className="mb-4 text-2xl font-bold">Create Competition</h3>
            <form onSubmit={handleCreateCompetition} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Competition title" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Competition prompt"
                  className="w-full rounded border bg-input p-2 text-foreground"
                  rows={4}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Max Iterations</label>
                  <Input type="number" value={maxIterations} onChange={(e) => setMaxIterations(e.target.value)} min="1" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Min Agents</label>
                  <Input type="number" value={minAgents} onChange={(e) => setMinAgents(e.target.value)} min="1" required />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating...' : 'Create Competition'}
              </Button>
            </form>
          </Card>
        )}

        {activeView === 'competitions' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={fetchCompetitions}>
                Refresh
              </Button>
            </div>
            {competitions.map((comp) => (
              <CompetitionCard
                key={comp.id}
                competition={comp}
                onView={(competition) => {
                  selectCompetition(competition);
                  fetchCompetitionDetails(String(competition.id));
                }}
                action={
                  <>
                    <Button
                      type="button"
                      disabled={loading || (comp.status || 'upcoming') !== 'upcoming'}
                      onClick={() => runInternalAction(`/internal/start-competition/${comp.id}`, 'Competition started')}
                    >
                      {comp.status === 'completed' ? 'Completed' : comp.status === 'ongoing' ? 'Ongoing' : 'Start'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      onClick={() => runInternalAction(`/internal/evaluate/${comp.id}`, 'Competition evaluated')}
                    >
                      Evaluate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      onClick={() => runInternalAction(`/internal/update-leaderboard/${comp.id}`, 'Leaderboard updated')}
                    >
                      Update Leaderboard
                    </Button>
                  </>
                }
              />
            ))}
            {competitions.length === 0 && <p className="text-muted-foreground">No competitions yet</p>}
            <CompetitionDetails competition={selectedCompetition} />
          </div>
        )}

        {activeView === 'submissions' && (
          <Card className="p-6">
            <h3 className="mb-4 text-2xl font-bold">Submissions</h3>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <Input value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} placeholder="Competition ID" />
              <Button type="button" onClick={() => fetchSubmissions(competitionId)}>
                Load Submissions
              </Button>
            </div>
            <SubmissionsList submissions={submissions} />
          </Card>
        )}

        {activeView === 'leaderboard' && (
          <Card className="p-6">
            <h3 className="mb-4 text-2xl font-bold">Leaderboard</h3>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <Input value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} placeholder="Competition ID" />
              <Button type="button" onClick={() => fetchLeaderboard(competitionId)}>
                Load Leaderboard
              </Button>
            </div>
            <LeaderboardList leaderboard={leaderboard} />
          </Card>
        )}

        {activeView === 'rewards' && (
          <Card className="p-6">
            <h3 className="mb-4 text-2xl font-bold">Rewards</h3>
            <Button
              type="button"
              disabled={loading}
              onClick={() => runInternalAction('/internal/distribute-rewards', 'Rewards distributed')}
            >
              Distribute Rewards
            </Button>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export function AgentDashboard() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<AgentView>('competitions');
  const [agentId, setAgentId] = useState('');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [participationIds, setParticipationIds] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardCompetitionId, setLeaderboardCompetitionId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [reasoningText, setReasoningText] = useState('');
  const [reasoningImageUrl, setReasoningImageUrl] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchCompetitions = async () => {
    try {
      const res = await fetch(`${API_BASE}/competitions`);
      const data = await res.json();
      setCompetitions(data);
    } catch (err) {
      console.error('Failed to fetch competitions:', err);
      setMessage('Failed to fetch competitions');
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('role');
    const storedAgentId = localStorage.getItem('agent_id') || '';

    if (role !== 'agent' || !storedAgentId) {
      router.push('/');
      return;
    }

    setAgentId(storedAgentId);
    setParticipationIds(JSON.parse(localStorage.getItem(`agent_participations_${storedAgentId}`) || '[]'));
    fetchCompetitions();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('role');
    localStorage.removeItem('agent_id');
    router.push('/');
  };

  const saveParticipation = (compId: string) => {
    const nextIds = Array.from(new Set([...participationIds, compId]));
    setParticipationIds(nextIds);
    localStorage.setItem(`agent_participations_${agentId}`, JSON.stringify(nextIds));
  };

  const handleJoinCompetition = async (compId: string) => {
    if (!agentId.trim()) {
      alert('Please enter an agent ID');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/competition/${compId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.msg || 'Joined competition');
        saveParticipation(compId);
        const joinedCompetition = competitions.find((comp) => String(comp.id) === compId);
        if (joinedCompetition) {
          setSelectedCompetition(joinedCompetition);
        }
        fetchCompetitions();
        fetchSubmissions(compId);
        fetchLeaderboard(compId);
      } else {
        const errorMessage = data.detail || data.msg || 'Failed to join competition';
        setMessage(errorMessage);
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Failed to join competition:', err);
      setMessage('Failed to join competition');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionDetails = async (compId: string) => {
    if (!compId.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/competition/${compId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedCompetition(data);
      } else {
        setMessage('Competition not found');
      }
    } catch (err) {
      console.error('Failed to fetch competition:', err);
      setMessage('Failed to fetch competition');
    }
  };

  const fetchSubmissions = async (compId: string) => {
    try {
      const res = await fetch(`${API_BASE}/competition/${compId}/submissions`);
      const data = await res.json();
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
      setMessage('Failed to fetch submissions');
    }
  };

  const fetchLeaderboard = async (compId: string) => {
    if (!compId.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/leaderboard/${compId}`);
      const data = await res.json();
      setLeaderboard(data);
      setLeaderboardCompetitionId(compId);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setMessage('Failed to fetch leaderboard');
    }
  };

  const handleSubmitOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetition) {
      setMessage('Select a competition first');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/submit-output`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competition_id: Number(selectedCompetition.id),
          agent_id: Number(agentId),
          image_url: imageUrl,
        }),
      });

      if (res.ok) {
        setImageUrl('');
        setMessage('Submission added');
        fetchSubmissions(String(selectedCompetition.id));
      } else {
        setMessage('Failed to submit output');
      }
    } catch (err) {
      console.error('Failed to submit output:', err);
      setMessage('Failed to submit output');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReasoning = (competition: Competition) => {
    setSelectedCompetition(competition);
    setReasoningText('');
    setReasoningImageUrl('');
    setStreamingReasoning(true);

    const source = new EventSource(`${API_BASE}/stream-agent/${competition.id}/${agentId}`);
    source.onmessage = (event) => {
      if (event.data === 'Competition already completed' || event.data === 'Competition not started yet') {
        setReasoningText(event.data);
        setStreamingReasoning(false);
        source.close();
        fetchCompetitions();
        fetchCompetitionDetails(String(competition.id));
        return;
      }

      if (event.data.startsWith('IMAGE_READY:')) {
        setReasoningImageUrl(event.data.replace('IMAGE_READY:', ''));
        setStreamingReasoning(false);
        source.close();
        fetchCompetitions();
        fetchCompetitionDetails(String(competition.id));
        fetchSubmissions(String(competition.id));
        fetchLeaderboard(String(competition.id));
        return;
      }
      setReasoningText((text) => text + event.data);
    };
    source.onerror = () => {
      setStreamingReasoning(false);
      source.close();
      fetchCompetitions();
      fetchCompetitionDetails(String(competition.id));
    };
  };

  useEffect(() => {
    const latestAgentSubmission = submissions
      .filter((submission) => String(submission.agent_id) === agentId)
      .sort((left, right) => (right.iteration_number || 0) - (left.iteration_number || 0))[0];

    if (!latestAgentSubmission) {
      return;
    }

    if (latestAgentSubmission.reasoning_text) {
      setReasoningText(latestAgentSubmission.reasoning_text);
    }

    if (latestAgentSubmission.image_url) {
      setReasoningImageUrl(latestAgentSubmission.image_url);
    }
  }, [agentId, submissions]);

  const joinedCompetitions = competitions.filter((comp) => participationIds.includes(String(comp.id)));
  const selectedAgentSubmission = submissions
    .filter((submission) => String(submission.agent_id) === agentId)
    .sort((left, right) => (right.iteration_number || 0) - (left.iteration_number || 0))[0];
  const agentItems = ['Competitions', 'My Participation', 'Leaderboard'];

  return (
    <DashboardLayout
      title="Agent Dashboard"
      subtitle={`Agent ${agentId || ''}`}
      items={agentItems}
      activeItem={activeView
        .replace('competitions', 'Competitions')
        .replace('participation', 'My Participation')
        .replace('leaderboard', 'Leaderboard')}
      onSelect={(item) =>
        setActiveView(
          item === 'My Participation'
            ? 'participation'
            : item.toLowerCase() as AgentView,
        )
      }
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        {message && <p className="rounded border p-3 text-sm text-muted-foreground">{message}</p>}

        {activeView === 'competitions' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={fetchCompetitions}>
                Refresh
              </Button>
            </div>
            {competitions.map((comp) => {
              const isFull = (comp.participant_count || 0) >= comp.min_agents;
              const isCompleted = comp.status === 'completed';

              return (
                <CompetitionCard
                  key={comp.id}
                  competition={comp}
                  onView={(competition) => fetchCompetitionDetails(String(competition.id))}
                  action={
                    <Button type="button" disabled={loading || isFull || isCompleted} onClick={() => handleJoinCompetition(String(comp.id))}>
                      {isCompleted ? 'Completed' : isFull ? 'Full' : 'Join'}
                    </Button>
                  }
                />
              );
            })}
            {competitions.length === 0 && <p className="text-muted-foreground">No competitions yet</p>}
            <CompetitionDetails competition={selectedCompetition} />

            {selectedCompetition && (
              <Card className="p-6">
                <h3 className="mb-4 text-2xl font-bold">Submit Output</h3>
                <form onSubmit={handleSubmitOutput} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Image URL</label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." required />
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Output'}
                  </Button>
                </form>
              </Card>
            )}
          </div>
        )}

        {activeView === 'participation' && (
          <div className="space-y-4">
            {joinedCompetitions.map((comp) => (
              <CompetitionCard
                key={comp.id}
                competition={comp}
                onView={(competition) => {
                  setSelectedCompetition(competition);
                  fetchCompetitionDetails(String(competition.id));
                  fetchSubmissions(String(competition.id));
                }}
                action={
                  comp.status === 'ongoing' ? (
                    <Button
                      type="button"
                      disabled={
                        streamingReasoning
                        || (
                          selectedCompetition?.id === comp.id
                          && selectedAgentSubmission?.generation_status === 'completed'
                        )
                      }
                      onClick={() => handleViewReasoning(comp)}
                    >
                      {selectedCompetition?.id === comp.id && selectedAgentSubmission?.generation_status === 'completed'
                        ? 'Completed'
                        : streamingReasoning && selectedCompetition?.id === comp.id
                          ? 'Streaming...'
                          : 'View Reasoning'}
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled>
                      {comp.status === 'completed' ? 'Completed' : 'Not started'}
                    </Button>
                  )
                }
              />
            ))}
            {joinedCompetitions.length === 0 && <p className="text-muted-foreground">No joined competitions yet</p>}
            <CompetitionDetails competition={selectedCompetition} />
            {(reasoningText || reasoningImageUrl || streamingReasoning) && (
              <Card className="p-4">
                <h3 className="mb-3 text-xl font-bold">Reasoning</h3>
                <pre className="mb-3 min-h-40 whitespace-pre-wrap rounded border bg-black p-3 text-sm text-green-300">
                  {splitGenerationText(reasoningText).reasoning || 'Waiting for Gemini...'}
                </pre>
                {splitGenerationText(reasoningText).finalPrompt && (
                  <div className="mb-3 rounded border border-border bg-muted p-3 text-sm text-muted-foreground">
                    {splitGenerationText(reasoningText).finalPrompt}
                  </div>
                )}
                {reasoningImageUrl && (
                  <img src={reasoningImageUrl} alt="Generated result" className="max-h-80 w-full rounded border border-border object-contain" />
                )}
              </Card>
            )}
            <SubmissionsList submissions={submissions} />
          </div>
        )}

        {activeView === 'leaderboard' && (
          <Card className="p-6">
            <h3 className="mb-4 text-2xl font-bold">Leaderboard</h3>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <Input
                value={leaderboardCompetitionId}
                onChange={(e) => setLeaderboardCompetitionId(e.target.value)}
                placeholder="Competition ID"
              />
              <Button type="button" onClick={() => fetchLeaderboard(leaderboardCompetitionId)}>
                Load Leaderboard
              </Button>
            </div>
            <LeaderboardList leaderboard={leaderboard} />
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
