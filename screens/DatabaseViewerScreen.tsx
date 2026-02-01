import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllParticipants, getParticipantsByEvent } from '../services/sqlite';
import { useEventContext } from '../navigation/EventContext';

type Participant = {
    uid: string;
    event_id: string;
    name: string;
    phone: string;
    email: string;
    checked_in: number;
    checkin_time: string | null;
    source: string;
    sync_status: number;
    team_name?: string;
    team_members?: string;
    participated?: number;  // Track attendance count
};

type GroupedParticipant = {
    id: string;
    name: string;
    email: string;
    phone: string;
    events: Participant[];
    expanded: boolean;
};

type GroupedTeam = {
    id: string;
    teamName: string;
    members: Participant[];
    expanded: boolean;
};

type ViewMode = 'individual' | 'teams';

export default function DatabaseViewerScreen() {
    const [viewMode, setViewMode] = useState<ViewMode>('individual');
    const [groupedUsers, setGroupedUsers] = useState<GroupedParticipant[]>([]);
    const [groupedTeams, setGroupedTeams] = useState<GroupedTeam[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const { eventContext } = useEventContext();

    const groupIndividualData = (data: Participant[]) => {
        const groups: { [key: string]: GroupedParticipant } = {};

        data.forEach(p => {
            const key = p.email || p.name;

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    name: p.name,
                    email: p.email,
                    phone: p.phone,
                    events: [],
                    expanded: false
                };
            }
            groups[key].events.push(p);
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    };

    const groupTeamData = (data: Participant[]) => {
        const teams: { [key: string]: GroupedTeam } = {};

        data.forEach(p => {
            if (p.team_name && p.team_name.trim() !== '') {
                const key = `${p.team_name}-${p.event_id}`;

                if (!teams[key]) {
                    teams[key] = {
                        id: key,
                        teamName: p.team_name,
                        members: [],
                        expanded: false
                    };
                }
                teams[key].members.push(p);
            }
        });

        return Object.values(teams).sort((a, b) => a.teamName.localeCompare(b.teamName));
    };

    const loadData = async () => {
        try {
            let data: Participant[] = [];
            const isSuperAdmin = eventContext?.adminEmail === 'admin@zorphix.com';

            if (isSuperAdmin) {
                data = await getAllParticipants();
            } else if (eventContext?.eventName) {
                data = await getParticipantsByEvent(eventContext.eventName);
            }

            // Filter to only show attended/scanned participants (participated > 0)
            // DISABLED FOR TESTING: Show all participants
            const attendedData = data.filter(p => (p.participated || 0) > 0);
            // const attendedData = data;

            // console.log('📊 Attended participants:', attendedData.length);
            setGroupedUsers(groupIndividualData(attendedData));
            setGroupedTeams(groupTeamData(attendedData));
        } catch (error) {
            console.error(error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [eventContext?.eventName])
    );

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const toggleExpandUser = (id: string) => {
        setGroupedUsers(prev => prev.map(user =>
            user.id === id ? { ...user, expanded: !user.expanded } : user
        ));
    };

    const toggleExpandTeam = (id: string) => {
        setGroupedTeams(prev => prev.map(team =>
            team.id === id ? { ...team, expanded: !team.expanded } : team
        ));
    };

    const renderIndividualItem = ({ item }: { item: GroupedParticipant }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => toggleExpandUser(item.id)}
            activeOpacity={0.8}
        >
            <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                    <Text style={styles.metaPhone}>{item.phone} • {item.events.length} Events</Text>
                </View>
                <Text style={styles.expandIcon}>{item.expanded ? '▲' : '▼'}</Text>
            </View>

            {item.expanded && (
                <View style={styles.eventsList}>
                    {item.events.map((event, index) => (
                        <View key={`${event.uid}-${event.event_id}-${index}`} style={[
                            styles.eventItem,
                            index === item.events.length - 1 && styles.lastEventItem
                        ]}>
                            <View style={styles.row}>
                                <Text style={styles.eventTitle}>{event.event_id}</Text>
                                <View style={[
                                    styles.badge,
                                    event.sync_status ? styles.badgeChecked : styles.badgeUnchecked
                                ]}>
                                    <Text style={styles.badgeText}>
                                        {event.sync_status ? 'Verified' : 'Pending'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.detail}>UID: {event.uid}</Text>
                            {event.team_name && (
                                <Text style={styles.teamInfo}>Team: {event.team_name}</Text>
                            )}
                            <Text style={styles.meta}>
                                Source: {event.source} • Sync: {event.sync_status ? 'Synced' : 'Pending'}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );

    const renderTeamItem = ({ item }: { item: GroupedTeam }) => {
        const eventName = item.members[0]?.event_id || 'Unknown Event';

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => toggleExpandTeam(item.id)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.userInfo}>
                        <Text style={styles.name}>🏆 {item.teamName}</Text>
                        <Text style={styles.email}>{eventName}</Text>
                        <Text style={styles.metaPhone}>{item.members.length} Members</Text>
                    </View>
                    <Text style={styles.expandIcon}>{item.expanded ? '▲' : '▼'}</Text>
                </View>

                {item.expanded && (
                    <View style={styles.eventsList}>
                        {item.members.map((member, index) => (
                            <View key={`${member.uid}-${index}`} style={[
                                styles.eventItem,
                                index === item.members.length - 1 && styles.lastEventItem
                            ]}>
                                <View style={styles.row}>
                                    <Text style={styles.memberName}>{member.name}</Text>
                                    <View style={[
                                        styles.badge,
                                        member.checked_in ? styles.badgeChecked : styles.badgeUnchecked
                                    ]}>
                                        <Text style={styles.badgeText}>
                                            {member.checked_in ? 'Verified' : 'Pending'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.detail}>{member.email}</Text>
                                <Text style={styles.detail}>{member.phone}</Text>
                                <Text style={styles.meta}>
                                    UID: {member.uid} • Source: {member.source}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>All Participants (Debug Mode)</Text>

            {/* View Mode Toggle */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        viewMode === 'individual' && styles.toggleButtonActive
                    ]}
                    onPress={() => setViewMode('individual')}
                >
                    <Text style={[
                        styles.toggleText,
                        viewMode === 'individual' && styles.toggleTextActive
                    ]}>
                        👤 Individual ({groupedUsers.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        viewMode === 'teams' && styles.toggleButtonActive
                    ]}
                    onPress={() => setViewMode('teams')}
                >
                    <Text style={[
                        styles.toggleText,
                        viewMode === 'teams' && styles.toggleTextActive
                    ]}>
                        🏆 Teams ({groupedTeams.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* List Display */}
            {viewMode === 'individual' ? (
                <FlatList
                    data={groupedUsers}
                    renderItem={renderIndividualItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
                    }
                    ListEmptyComponent={<Text style={styles.emptyText}>No participants found.</Text>}
                />
            ) : (
                <FlatList
                    data={groupedTeams}
                    renderItem={renderTeamItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
                    }
                    ListEmptyComponent={<Text style={styles.emptyText}>No teams found.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        padding: 20
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 15
    },
    toggleContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 10
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center'
    },
    toggleButtonActive: {
        backgroundColor: '#FFD700',
        borderColor: '#FFD700'
    },
    toggleText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600'
    },
    toggleTextActive: {
        color: '#000',
        fontWeight: 'bold'
    },
    list: {
        paddingBottom: 20
    },
    card: {
        backgroundColor: '#111',
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden'
    },
    cardHeader: {
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1a1a1a'
    },
    userInfo: {
        flex: 1
    },
    expandIcon: {
        color: '#FFD700',
        fontSize: 18,
        paddingLeft: 10
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4
    },
    email: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 2
    },
    metaPhone: {
        color: '#888',
        fontSize: 12
    },
    eventsList: {
        backgroundColor: '#111',
        borderTopWidth: 1,
        borderTopColor: '#333'
    },
    eventItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    lastEventItem: {
        borderBottomWidth: 0
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5
    },
    eventTitle: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: '600'
    },
    memberName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600'
    },
    detail: {
        color: '#aaa',
        fontSize: 12,
        marginBottom: 2
    },
    teamInfo: {
        color: '#4CAF50',
        fontSize: 12,
        marginBottom: 2,
        fontWeight: 'bold'
    },
    meta: {
        color: '#666',
        fontSize: 10,
        fontStyle: 'italic'
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 50
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8
    },
    badgeChecked: {
        backgroundColor: '#006400'
    },
    badgeUnchecked: {
        backgroundColor: '#8B0000'
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    }
});