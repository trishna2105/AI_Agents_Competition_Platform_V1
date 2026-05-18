'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const AUTO_REFRESH_MS = 15000;

type NavView = 'home' | 'competitions' | 'competition-live' | 'register' | 'leaderboard' | 'propose';
type CompetitionFilter = 'all' | 'registration' | 'active' | 'completed';

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

interface CompetitionParticipant {
  agent_id: string | number;
  name: string;
  model_name?: string | null;
}

interface AgentStreamState {
  reasoningText: string;
  imageUrl: string;
  status: 'idle' | 'waiting' | 'streaming' | 'completed' | 'failed';
}

interface Submission {
  agent_id: string | number;
  submission_id?: string | number;
  image_url: string;
  score: number | null;
  reason?: string | null;
}

interface LeaderboardEntry {
  agent_id: string | number;
  score: number | null;
  reason?: string | null;
  rank?: number;
}

const navItems: { key: NavView; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'competitions', label: 'Competitions' },
  { key: 'register', label: 'Register' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'propose', label: 'Propose' },
];

const competitionFilters: { key: CompetitionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'registration', label: 'Registration' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

function getStatus(value?: string) {
  return value || 'upcoming';
}

function getStatusLabel(value?: string) {
  const status = getStatus(value);

  if (status === 'ongoing') return 'Active';
  if (status === 'completed') return 'Completed';
  return 'Registration';
}

function getStatusClasses(value?: string) {
  const status = getStatus(value);

  if (status === 'ongoing') {
    return 'border-orange-300/50 bg-orange-300/10 text-orange-200';
  }

  if (status === 'completed') {
    return 'border-amber-300/50 bg-amber-300/10 text-amber-200';
  }

  return 'border-primary/50 bg-primary/10 text-primary';
}

function formatDate(value?: string) {
  if (!value) return 'Recently added';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently added';

  return date.toLocaleDateString();
}

function trimText(value: string, max = 150) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
}

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

function formatScore(value: number | null) {
  if (value === null) return 'Not scored';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function SectionHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-2 text-sm uppercase tracking-[0.35em] text-primary">{kicker}</p>
        <h2 className="text-3xl font-black sm:text-4xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card className="p-5 text-center">
      <p className="text-3xl font-black text-primary sm:text-4xl">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.35em] text-muted-foreground">{label}</p>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="p-6 text-sm text-muted-foreground">
      {text}
    </Card>
  );
}

export default function PlatformPage() {
  const router = useRouter();

  const [activeView, setActiveView] = useState<NavView>('home');
  const [competitionFilter, setCompetitionFilter] = useState<CompetitionFilter>('all');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(true);
  const [loadingCompletedBoards, setLoadingCompletedBoards] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [modelName, setModelName] = useState('vertex');
  const [registerMessage, setRegisterMessage] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [creatorMessage, setCreatorMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [maxIterations, setMaxIterations] = useState('5');
  const [minAgents, setMinAgents] = useState('2');
  const [lookupCompetitionId, setLookupCompetitionId] = useState('');
  const [creatorSubmissions, setCreatorSubmissions] = useState<Submission[]>([]);
  const [creatorLeaderboard, setCreatorLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardsByCompetition, setLeaderboardsByCompetition] = useState<Record<string, LeaderboardEntry[]>>({});
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<CompetitionParticipant[]>([]);
  const [liveAgentStates, setLiveAgentStates] = useState<Record<string, AgentStreamState>>({});
  const [liveMessage, setLiveMessage] = useState('');

  const fetchCompetitions = useEffectEvent(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoadingCompetitions(true);
    }

    try {
      const response = await fetch(`${API_BASE}/competitions`);
      const data = await response.json();
      setCompetitions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);

      if (!options?.silent) {
        setCompetitions([]);
        setJoinMessage('Unable to load competitions right now.');
      }
    } finally {
      if (!options?.silent) {
        setLoadingCompetitions(false);
      }
    }
  });

  useEffect(() => {
    const savedAgentId = localStorage.getItem('agent_id') || localStorage.getItem('latest_agent_id') || '';
    if (savedAgentId) {
      setCurrentAgentId(savedAgentId);
    }

    void fetchCompetitions();

    const refreshInterval = window.setInterval(() => {
      void fetchCompetitions({ silent: true });
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    const completedCompetitions = competitions.filter((competition) => getStatus(competition.status) === 'completed');

    if (completedCompetitions.length === 0) {
      setLeaderboardsByCompetition({});
      return;
    }

    let cancelled = false;

    const loadLeaderboards = async () => {
      setLoadingCompletedBoards(true);

      try {
        const results = await Promise.all(
          completedCompetitions.map(async (competition) => {
            const response = await fetch(`${API_BASE}/leaderboard/${competition.id}`);
            const data = await response.json();
            return [String(competition.id), Array.isArray(data) ? data : []] as const;
          }),
        );

        if (!cancelled) {
          setLeaderboardsByCompetition(Object.fromEntries(results));
        }
      } catch (error) {
        console.error('Failed to fetch leaderboards:', error);
        if (!cancelled) {
          setLeaderboardsByCompetition({});
        }
      } finally {
        if (!cancelled) {
          setLoadingCompletedBoards(false);
        }
      }
    };

    loadLeaderboards();

    return () => {
      cancelled = true;
    };
  }, [competitions]);

  const filteredCompetitions = useMemo(() => {
    return competitions.filter((competition) => {
      const status = getStatus(competition.status);

      if (competitionFilter === 'registration') return status === 'upcoming';
      if (competitionFilter === 'active') return status === 'ongoing';
      if (competitionFilter === 'completed') return status === 'completed';

      return true;
    });
  }, [competitionFilter, competitions]);

  const completedCompetitions = useMemo(() => {
    return competitions.filter((competition) => getStatus(competition.status) === 'completed');
  }, [competitions]);

  const stats = useMemo(() => {
    return {
      total: competitions.length,
      registration: competitions.filter((competition) => getStatus(competition.status) === 'upcoming').length,
      active: competitions.filter((competition) => getStatus(competition.status) === 'ongoing').length,
      completed: competitions.filter((competition) => getStatus(competition.status) === 'completed').length,
    };
  }, [competitions]);

  const openCompetitionLive = async (competition: Competition) => {
    setBusyKey(`open-${competition.id}`);
    setLiveMessage('');
    setSelectedCompetition(competition);
    setLiveParticipants([]);
    setLiveAgentStates({});
    setActiveView('competition-live');

    try {
      const [competitionResponse, participantsResponse] = await Promise.all([
        
        fetch(`${API_BASE}/competition/${competition.id}`),
        fetch(`${API_BASE}/competition/${competition.id}/participants`),
      ]);

      const subsRes = await fetch(`${API_BASE}/competition/${competition.id}/submissions`);
      const subsData = await subsRes.json();
      setCreatorSubmissions(Array.isArray(subsData) ? subsData : []);
      const competitionData = await competitionResponse.json();
      const participantsData = await participantsResponse.json();

      if (!competitionResponse.ok) {
        setLiveMessage(competitionData.detail || 'Unable to load competition.');
        return;
      }

      setSelectedCompetition(competitionData);
      setLiveParticipants(Array.isArray(participantsData) ? participantsData : []);
    } catch (error) {
      console.error('Failed to open competition:', error);
      setLiveMessage('Unable to load competition.');
    } finally {
      setBusyKey('');
    }
  };

  useEffect(() => {
    if (activeView !== 'competition-live' || !selectedCompetition || liveParticipants.length === 0) {
      return;
    }

    if (selectedCompetition.status === 'upcoming') {
      return;
    }

    const sources = liveParticipants.map((participant) => {
      const key = String(participant.agent_id);

      setLiveAgentStates((current) => ({
        ...current,
        [key]: current[key] || {
          reasoningText: '',
          imageUrl: '',
          status: selectedCompetition.status === 'completed' ? 'completed' : 'streaming',
        },
      }));

      const source = new EventSource(`${API_BASE}/stream-agent/${selectedCompetition.id}/${participant.agent_id}`);

      source.onmessage = (event) => {
        const data = event.data || '';

        if (data.startsWith('IMAGE_READY:')) {
          setLiveAgentStates((current) => ({
            ...current,
            [key]: {
              ...(current[key] || { reasoningText: '', imageUrl: '', status: 'streaming' as const }),
              imageUrl: data.replace('IMAGE_READY:', ''),
              status: 'completed',
            },
          }));
          source.close();
          return;
        }

        if (data === 'Competition not started yet' || data === 'Competition already completed') {
          setLiveAgentStates((current) => ({
            ...current,
            [key]: {
              ...(current[key] || { reasoningText: '', imageUrl: '', status: 'idle' as const }),
              status: data === 'Competition not started yet' ? 'waiting' : 'completed',
            },
          }));
          source.close();
          return;
        }

        if (data.startsWith('Gemini error:')) {
          setLiveAgentStates((current) => ({
            ...current,
            [key]: {
              ...(current[key] || { reasoningText: '', imageUrl: '', status: 'streaming' as const }),
              reasoningText: `${current[key]?.reasoningText || ''}${data}`,
              status: 'failed',
            },
          }));
          source.close();
          return;
        }

        setLiveAgentStates((current) => ({
          ...current,
          [key]: {
            ...(current[key] || { reasoningText: '', imageUrl: '', status: 'streaming' as const }),
            reasoningText: `${current[key]?.reasoningText || ''}${data}`,
            status: 'streaming',
          },
        }));
      };

      source.onerror = () => {
        source.close();
      };

      return source;
    });

    return () => {
      sources.forEach((source) => source.close());
    };
  }, [activeView, liveParticipants, selectedCompetition]);

  const saveAgentId = (agentId: string) => {
    localStorage.setItem('agent_id', agentId);
    localStorage.setItem('latest_agent_id', agentId);
    setCurrentAgentId(agentId);
  };

  const handleRegisterAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyKey('register');
    setRegisterMessage('');

    try {
      const response = await fetch(
        `${API_BASE}/agent/register?name=${encodeURIComponent(agentName)}&model_name=${encodeURIComponent(modelName)}`,
        { method: 'POST' },
      );
      const data = await response.json();

      if (!response.ok) {
        setRegisterMessage('Agent registration failed.');
        return;
      }

      const agentId = String(data.agent_id || '');
      if (agentId) {
        saveAgentId(agentId);
      }

      setAgentName('');
      setRegisterMessage(agentId ? `Agent registered successfully. Agent ID: ${agentId}` : 'Agent registered successfully.');
    } catch (error) {
      console.error('Failed to register agent:', error);
      setRegisterMessage('Agent registration failed.');
    } finally {
      setBusyKey('');
    }
  };

  const handleSaveExistingAgent = (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentAgentId.trim()) {
      setRegisterMessage('Enter an Agent ID first.');
      return;
    }

    saveAgentId(currentAgentId.trim());
    setRegisterMessage(`Current Agent ID set to ${currentAgentId.trim()}.`);
  };

  const handleJoinCompetition = async (competitionId: string) => {
    if (!currentAgentId.trim()) {
      setActiveView('register');
      setRegisterMessage('Register an agent or add your Agent ID before joining a competition.');
      return;
    }

    setBusyKey(`join-${competitionId}`);
    setJoinMessage('');

    try {
      const response = await fetch(`${API_BASE}/competition/${competitionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: Number(currentAgentId) }),
      });
      const data = await response.json();

      if (!response.ok) {
        setJoinMessage(data.detail || data.msg || 'Unable to join competition.');
        return;
      }

      setJoinMessage(data.msg || 'Joined competition successfully.');
      fetchCompetitions();
    } catch (error) {
      console.error('Failed to join competition:', error);
      setJoinMessage('Unable to join competition.');
    } finally {
      setBusyKey('');
    }
  };

  const runCreatorAction = async (path: string, successMessage: string, key: string) => {
    setBusyKey(key);
    setCreatorMessage('');

    try {
      const response = await fetch(`${API_BASE}${path}`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        setCreatorMessage(data.detail || data.msg || 'Action failed.');
        return;
      }

      setCreatorMessage(successMessage);
      fetchCompetitions();
    } catch (error) {
      console.error('Creator action failed:', error);
      setCreatorMessage('Action failed.');
    } finally {
      setBusyKey('');
    }
  };

  const handleCreateCompetition = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyKey('create-competition');
    setCreatorMessage('');

    try {
      const response = await fetch(`${API_BASE}/competition/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          prompt,
          max_iterations: Number(maxIterations),
          min_agents: Number(minAgents),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreatorMessage(data.detail || data.msg || 'Competition creation failed.');
        return;
      }

      setTitle('');
      setPrompt('');
      setMaxIterations('5');
      setMinAgents('2');
      setCreatorMessage(data.msg || 'Competition created successfully.');
      fetchCompetitions();
    } catch (error) {
      console.error('Failed to create competition:', error);
      setCreatorMessage('Competition creation failed.');
    } finally {
      setBusyKey('');
    }
  };

  const loadCreatorSubmissions = async () => {
    if (!lookupCompetitionId.trim()) {
      setCreatorMessage('Enter a competition ID to load submissions.');
      return;
    }

    setBusyKey('load-submissions');
    setCreatorMessage('');

    try {
      const response = await fetch(`${API_BASE}/competition/${lookupCompetitionId}/submissions`);
      const data = await response.json();

      if (!response.ok) {
        setCreatorMessage(data.detail || 'Unable to load submissions.');
        return;
      }

      setCreatorSubmissions(Array.isArray(data) ? data : []);
      setCreatorMessage('Submissions loaded.');
    } catch (error) {
      console.error('Failed to load submissions:', error);
      setCreatorMessage('Unable to load submissions.');
    } finally {
      setBusyKey('');
    }
  };

  const loadCreatorLeaderboard = async () => {
    if (!lookupCompetitionId.trim()) {
      setCreatorMessage('Enter a competition ID to load leaderboard data.');
      return;
    }

    setBusyKey('load-leaderboard');
    setCreatorMessage('');

    try {
      const response = await fetch(`${API_BASE}/leaderboard/${lookupCompetitionId}`);
      const data = await response.json();

      if (!response.ok) {
        setCreatorMessage(data.detail || 'Unable to load leaderboard.');
        return;
      }

      setCreatorLeaderboard(Array.isArray(data) ? data : []);
      setCreatorMessage('Leaderboard loaded.');
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      setCreatorMessage('Unable to load leaderboard.');
    } finally {
      setBusyKey('');
    }
  };

  const openAgentDashboard = () => {
    if (!currentAgentId.trim()) {
      setRegisterMessage('Set an Agent ID before opening the agent dashboard.');
      return;
    }

    localStorage.setItem('role', 'agent');
    localStorage.setItem('agent_id', currentAgentId.trim());
    router.push('/agent');
  };

  const openCreatorDashboard = () => {
    localStorage.setItem('role', 'creator');
    router.push('/creator');
  };

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="sticky top-0 z-20 mb-8 border border-border bg-background/90 backdrop-blur">
          <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-primary">AI Arena</p>
              <h1 className="text-xl font-black sm:text-2xl">AI Agents Competition Platform</h1>
            </div>

            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={activeView === item.key ? 'default' : 'ghost'}
                  onClick={() => setActiveView(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>
        </header>

        {activeView === 'home' && (
          <div className="space-y-8">
            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="p-8 sm:p-12">
                <p className="mb-6 inline-flex border border-primary/40 bg-primary/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-primary">
                  Agents Register • Compete • Win
                </p>
                <h2 className="max-w-4xl text-4xl font-black leading-tight sm:text-6xl">
                  AI AGENTS
                  <br />
                  COMPETITION
                  <br />
                  PLATFORM
                </h2>
                <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                  This is the home page for the project. You can replace this text later with your platform story,
                  competition rules, roadmap, or anything else you want to explain here.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button type="button" size="lg" onClick={() => setActiveView('competitions')}>
                    Browse Competitions
                  </Button>
                  <Button type="button" size="lg" variant="outline" onClick={() => setActiveView('register')}>
                    Register Agent
                  </Button>
                </div>
              </Card>

              <Card className="p-6">
                <p className="mb-3 text-sm uppercase tracking-[0.3em] text-primary">Overview</p>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>Build, Compete, and Evaluate AI Agents</p>
                  <p>Create challenges, deploy AI agents, and discover which model performs best.</p>
                  <p>Define a prompt, let agents generate outputs, and watch them get scored and ranked in real time.</p>
                  <p>Start exploring competitions, register your agent, and climb the leaderboard.</p>
                </div>
              </Card>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard value={stats.total} label="Total Competitions" />
              <StatCard value={stats.registration} label="Registration Open" />
              <StatCard value={stats.active} label="Active Competitions" />
              <StatCard value={stats.completed} label="Completed Competitions" />
            </section>
          </div>
        )}

        {activeView === 'competitions' && (
          <div>
            <SectionHeader
              kicker="// browse"
              title="Competitions"
              description="Browse every competition, filter by status, and join directly with your saved Agent ID."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => fetchCompetitions()}>
                    Refresh
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setActiveView('register')}>
                    Register Agent
                  </Button>
                </div>
              }
            />

            <Card className="mb-6 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-primary">Current Agent</p>
                  <p className="mt-1 text-lg font-bold">{currentAgentId || 'No Agent ID selected yet'}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    value={currentAgentId}
                    onChange={(event) => setCurrentAgentId(event.target.value)}
                    placeholder="Enter Agent ID"
                    className="sm:w-56"
                  />
                  <Button type="button" variant="outline" onClick={handleSaveExistingAgent}>
                    Save Agent ID
                  </Button>
                </div>
              </div>
              {joinMessage && <p className="mt-3 text-sm text-muted-foreground">{joinMessage}</p>}
            </Card>

            <div className="mb-6 flex flex-wrap gap-2">
              {competitionFilters.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={competitionFilter === item.key ? 'default' : 'outline'}
                  onClick={() => setCompetitionFilter(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {loadingCompetitions ? (
              <EmptyState text="Loading competitions..." />
            ) : filteredCompetitions.length === 0 ? (
              <EmptyState text="No competitions found for this filter." />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredCompetitions.map((competition) => {
                  const competitionId = String(competition.id);
                  const status = getStatus(competition.status);
                  const isCompleted = status === 'completed';
                  const isOpenable = status === 'ongoing' || status === 'completed';

                  return (
                    <Card
                      key={competitionId}
                      className={`p-5 ${isOpenable ? 'cursor-pointer transition hover:border-primary/60' : ''}`}
                      onClick={() => {
                        if (isOpenable) {
                          void openCompetitionLive(competition);
                        }
                      }}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <span className={`inline-flex border px-3 py-1 text-xs uppercase tracking-[0.28em] ${getStatusClasses(status)}`}>
                          {getStatusLabel(status)}
                        </span>
                        <span className="text-xs text-muted-foreground">#{competition.id}</span>
                      </div>

                      <h3 className="text-2xl font-bold">{competition.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{trimText(competition.prompt)}</p>

                      <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <p>Participants: {competition.participant_count || 0}/{competition.min_agents}</p>
                        <p>Max Iterations: {competition.max_iterations}</p>
                        <p>Status: {getStatusLabel(status)}</p>
                        <p>Created: {formatDate(competition.created_at)}</p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busyKey === `join-${competitionId}` || isCompleted}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleJoinCompetition(competitionId);
                          }}
                        >
                          {isCompleted ? 'Completed' : busyKey === `join-${competitionId}` ? 'Joining...' : 'Join Competition'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!isOpenable || busyKey === `open-${competitionId}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (isOpenable) {
                              void openCompetitionLive(competition);
                            }
                          }}
                        >
                          {busyKey === `open-${competitionId}` ? 'Opening...' : 'Open Competition'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeView === 'competition-live' && (
          <div>
            <SectionHeader
              kicker="// live"
              title={selectedCompetition?.title || 'Competition Live'}
              description={selectedCompetition?.prompt || 'Loading competition prompt...'}
              action={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setActiveView('competitions')}>
                    Back To Competitions
                  </Button>
                  {selectedCompetition && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyKey === `open-${selectedCompetition.id}`}
                      onClick={() => void openCompetitionLive(selectedCompetition)}
                    >
                      {busyKey === `open-${selectedCompetition.id}` ? 'Refreshing...' : 'Refresh Live View'}
                    </Button>
                  )}
                </div>
              }
            />

            {liveMessage && <Card className="mb-6 p-4 text-sm text-muted-foreground">{liveMessage}</Card>}

            {selectedCompetition?.status === 'upcoming' && (
              <Card className="mb-6 p-4 text-sm text-muted-foreground">
                This competition has not started yet.
              </Card>
            )}

            {selectedCompetition && busyKey === `open-${selectedCompetition.id}` ? (
              <EmptyState text="Loading live competition..." />
            ) : liveParticipants.length === 0 ? (
              <EmptyState text="No agents have joined this competition yet." />
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${liveParticipants.length}, minmax(320px, 1fr))` }}
                >
                  {liveParticipants.map((participant) => {
                    const state = liveAgentStates[String(participant.agent_id)] || {
                      reasoningText: '',
                      imageUrl: '',
                      status: 'idle' as const,
                    };
                    const { reasoning, finalPrompt } = splitGenerationText(state.reasoningText);

                    return (
                      <Card key={participant.agent_id} className="p-4">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-primary">Agent {participant.agent_id}</p>
                            <h3 className="mt-2 text-xl font-bold">{participant.name}</h3>
                          </div>
                          <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{state.status}</span>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-primary">Reasoning</p>
                            <pre className="min-h-48 whitespace-pre-wrap rounded border border-border bg-black p-3 text-sm text-green-300">
                              {reasoning || (state.status === 'waiting' ? 'Waiting for competition to start...' : 'Waiting for reasoning...')}
                            </pre>
                          </div>

                          {finalPrompt && (
                            <div>
                              <p className="mb-2 text-xs uppercase tracking-[0.24em] text-primary">Final Prompt</p>
                              <div className="rounded border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                                {finalPrompt}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-primary">Generated Image</p>
                            {state.imageUrl ? (
                              <img
                                src={state.imageUrl}
                                alt={`Generated result for agent ${participant.agent_id}`}
                                className="max-h-96 w-full rounded border border-border object-contain"
                              />
                            ) : (
                              <div className="rounded border border-dashed border-border p-6 text-sm text-muted-foreground">
                                {state.status === 'completed' ? 'No image was returned.' : 'Image is being generated...'}
                              </div>
                            )}
                            {selectedCompetition?.status === 'completed' && (
                              <div className="mt-4">
                                <p className="mb-2 text-xs uppercase tracking-[0.24em] text-primary">Result</p>

                                {creatorSubmissions
                                  .filter(s => String(s.agent_id) === String(participant.agent_id))
                                  .map((s, i) => (
                                    <div key={i} className="text-sm text-muted-foreground">
                                      <p>Score: {s.score}</p>
                                      <p>Reason: {s.reason}</p>
                                    </div>
                                  ))
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'register' && (
          <div>
            <SectionHeader
              kicker="// register"
              title="Register Your Agent"
              description="Use the existing backend registration flow, save your Agent ID, and continue directly to competitions."
              action={
                <Button type="button" variant="outline" onClick={openAgentDashboard}>
                  Open Agent Dashboard
                </Button>
              }
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <h3 className="mb-4 text-2xl font-bold">New Agent Registration</h3>
                <form onSubmit={handleRegisterAgent} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Agent Name</label>
                    <Input
                      value={agentName}
                      onChange={(event) => setAgentName(event.target.value)}
                      placeholder="Enter agent name"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Model</label>
                    <select
                      value={modelName}
                      onChange={(event) => setModelName(event.target.value)}
                      className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none"
                    >
                      <option value="vertex">Vertex (Imagen)</option>
                      <option value="huggingface">HuggingFace</option>
                    </select>
                  </div>

                  <Button type="submit" className="w-full" disabled={busyKey === 'register'}>
                    {busyKey === 'register' ? 'Registering...' : 'Register Agent'}
                  </Button>
                </form>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-2xl font-bold">Use Existing Agent ID</h3>
                <form onSubmit={handleSaveExistingAgent} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Agent ID</label>
                    <Input
                      value={currentAgentId}
                      onChange={(event) => setCurrentAgentId(event.target.value)}
                      placeholder="Enter your existing Agent ID"
                    />
                  </div>

                  <Button type="submit" variant="outline" className="w-full">
                    Save Current Agent ID
                  </Button>
                </form>

                <div className="mt-6 rounded border border-border bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-primary">Active Agent</p>
                  <p className="mt-2 text-2xl font-black">{currentAgentId || 'Not set yet'}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Once this is saved, you can join competitions from the Competitions page.
                  </p>
                </div>
              </Card>
            </div>

            {registerMessage && (
              <Card className="mt-6 p-4 text-sm text-muted-foreground">
                {registerMessage}
              </Card>
            )}
          </div>
        )}

        {activeView === 'leaderboard' && (
          <div>
            <SectionHeader
              kicker="// results"
              title="Leaderboard"
              description="Completed competitions and winners are shown here automatically once scoring finishes."
              action={
                <Button type="button" variant="outline" onClick={fetchCompetitions}>
                  Refresh Results
                </Button>
              }
            />

            {loadingCompletedBoards ? (
              <EmptyState text="Loading leaderboard results..." />
            ) : completedCompetitions.length === 0 ? (
              <EmptyState text="No completed competitions are available yet." />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {completedCompetitions.map((competition) => {
                  const entries = leaderboardsByCompetition[String(competition.id)] || [];
                  const winner = entries[0];

                  return (
                    <Card key={competition.id} className="p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <span className={`inline-flex border px-3 py-1 text-xs uppercase tracking-[0.28em] ${getStatusClasses('completed')}`}>
                          Completed
                        </span>
                        <span className="text-xs text-muted-foreground">Competition #{competition.id}</span>
                      </div>

                      <h3 className="text-2xl font-bold">{competition.title}</h3>
                      <p className="mt-3 text-sm text-muted-foreground">{trimText(competition.prompt, 120)}</p>

                      <div className="mt-5 rounded border border-primary/30 bg-primary/10 p-4">
                        <p className="text-xs uppercase tracking-[0.28em] text-primary">Winner</p>
                        <p className="mt-2 text-2xl font-black">
                          {winner ? `Agent ${winner.agent_id}` : 'No ranked submissions'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {winner ? `Top score: ${formatScore(winner.score)}` : 'This competition finished without scored submissions.'}
                        </p>
                      </div>

                      <div className="mt-5 space-y-2">
                        {entries.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No leaderboard entries available yet.</p>
                        ) : (
                          entries.map((entry, index) => (
                            <div key={`${competition.id}-${entry.agent_id}-${index}`} className="flex items-center justify-between border border-border bg-muted/40 px-4 py-3 text-sm">
                              <span className="font-medium">#{entry.rank ?? index + 1} Agent {entry.agent_id}</span>
                              <span className="text-muted-foreground">{formatScore(entry.score)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeView === 'propose' && (
          <div>
            <SectionHeader
              kicker="// create"
              title="Propose A Competition"
              description="This page keeps the creator-side functionality available here: create competitions, manage competition status, inspect submissions, and rebuild leaderboard results when needed."
              action={
                <Button type="button" variant="outline" onClick={openCreatorDashboard}>
                  Open Creator Dashboard
                </Button>
              }
            />

            <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
              <Card className="p-6">
                <h3 className="mb-4 text-2xl font-bold">Create Competition</h3>
                <form onSubmit={handleCreateCompetition} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Title</label>
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Competition title"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Prompt</label>
                    <Textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Competition prompt"
                      rows={5}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Max Iterations</label>
                      <Input
                        type="number"
                        min="1"
                        value={maxIterations}
                        onChange={(event) => setMaxIterations(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Min Agents</label>
                      <Input
                        type="number"
                        min="1"
                        value={minAgents}
                        onChange={(event) => setMinAgents(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={busyKey === 'create-competition'}>
                    {busyKey === 'create-competition' ? 'Creating...' : 'Create Competition'}
                  </Button>
                </form>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-2xl font-bold">Creator Tools</h3>
                <div className="grid gap-4">
                  <div className="rounded border border-border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Use the existing creator workflow directly from here, or open the original creator dashboard page if you want the older layout.</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={lookupCompetitionId}
                      onChange={(event) => setLookupCompetitionId(event.target.value)}
                      placeholder="Competition ID"
                    />
                    <Button type="button" variant="outline" onClick={loadCreatorSubmissions} disabled={busyKey === 'load-submissions'}>
                      {busyKey === 'load-submissions' ? 'Loading...' : 'Submissions'}
                    </Button>
                    <Button type="button" variant="outline" onClick={loadCreatorLeaderboard} disabled={busyKey === 'load-leaderboard'}>
                      {busyKey === 'load-leaderboard' ? 'Loading...' : 'Leaderboard'}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyKey === 'rewards'}
                    onClick={() => runCreatorAction('/internal/distribute-rewards', 'Rewards distributed.', 'rewards')}
                  >
                    {busyKey === 'rewards' ? 'Distributing...' : 'Distribute Rewards'}
                  </Button>
                </div>
              </Card>
            </div>

            {creatorMessage && (
              <Card className="mt-6 p-4 text-sm text-muted-foreground">
                {creatorMessage}
              </Card>
            )}

            <div className="mt-6 grid gap-4">
              {competitions.length === 0 ? (
                <EmptyState text="No competitions are available to manage yet." />
              ) : (
                competitions.map((competition) => (
                  <Card key={`creator-${competition.id}`} className="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <span className={`inline-flex border px-3 py-1 text-xs uppercase tracking-[0.28em] ${getStatusClasses(competition.status)}`}>
                            {getStatusLabel(competition.status)}
                          </span>
                          <span className="text-xs text-muted-foreground">Competition #{competition.id}</span>
                        </div>
                        <h3 className="text-2xl font-bold">{competition.title}</h3>
                        <p className="mt-3 max-w-4xl text-sm text-muted-foreground">{trimText(competition.prompt, 180)}</p>
                        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <p>Participants: {competition.participant_count || 0}/{competition.min_agents}</p>
                          <p>Max Iterations: {competition.max_iterations}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busyKey === `start-${competition.id}` || getStatus(competition.status) !== 'upcoming'}
                          onClick={() =>
                            runCreatorAction(
                              `/internal/start-competition/${competition.id}`,
                              'Competition started.',
                              `start-${competition.id}`,
                            )
                          }
                        >
                          {getStatus(competition.status) === 'completed'
                            ? 'Completed'
                            : getStatus(competition.status) === 'ongoing'
                              ? 'Ongoing'
                              : busyKey === `start-${competition.id}`
                                ? 'Starting...'
                                : 'Start'}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={busyKey === `evaluate-${competition.id}`}
                          onClick={() =>
                            runCreatorAction(
                              `/internal/evaluate/${competition.id}`,
                              'Competition scored and completed.',
                              `evaluate-${competition.id}`,
                            )
                          }
                        >
                          {busyKey === `evaluate-${competition.id}` ? 'Evaluating...' : 'Evaluate'}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={busyKey === `leaderboard-${competition.id}`}
                          onClick={() =>
                            runCreatorAction(
                              `/internal/update-leaderboard/${competition.id}`,
                              'Leaderboard rebuilt.',
                              `leaderboard-${competition.id}`,
                            )
                          }
                        >
                          {busyKey === `leaderboard-${competition.id}` ? 'Updating...' : 'Rebuild Leaderboard'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Card className="p-6">
                <h3 className="mb-4 text-2xl font-bold">Competition Submissions</h3>
                {creatorSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Load a competition to display submissions here.</p>
                ) : (
                  <div className="grid gap-4">
                    {creatorSubmissions.map((submission, index) => (
                      <div key={`${submission.submission_id || index}`} className="rounded border border-border bg-muted/40 p-4">
                        <p className="font-medium">Agent {submission.agent_id}</p>
                        {submission.image_url && (
                          <img
                            src={submission.image_url}
                            alt="Submission"
                            className="mt-3 max-h-72 w-full rounded border border-border object-contain"
                          />
                        )}
                        <p className="mt-3 text-sm text-muted-foreground">Score: {submission.score ?? 'Not scored'}</p>
                        {submission.reason && <p className="mt-1 text-sm text-muted-foreground">Reason: {submission.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 text-2xl font-bold">Competition Leaderboard</h3>
                {creatorLeaderboard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Load a competition to display leaderboard data here.</p>
                ) : (
                  <div className="space-y-3">
                    {creatorLeaderboard.map((entry, index) => (
                      <div key={`${entry.agent_id}-${index}`} className="flex items-center justify-between rounded border border-border bg-muted/40 px-4 py-3">
                        <span className="font-medium">Agent {entry.agent_id}</span>
                        <span className="text-sm text-muted-foreground">{formatScore(entry.score)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
