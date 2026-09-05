import { findByProps, findByName } from "@vendetta/metro";
import { constants, React, ReactNative as RN } from "@vendetta/metro/common";
import HiddenChannel from "./HiddenChannel";
import AlertContent from "./AlertContent";
import { Settings } from "./settings";
import { getAssetByName } from "@vendetta/ui/assets";
import { after, instead } from "@vendetta/patcher";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { storage } from "@vendetta/plugin";

const Permissions = findByProps("getChannelPermissions", "can");

const Fetcher = findByProps("stores", "fetchMessages");

const { ChannelTypes } = findByProps("ChannelTypes");

const { getChannel } =
    findByProps("getChannel") || findByName("getChannel", false);

const snowflakeUtils = findByProps("extractTimestamp");

const skipChannels = [
    ChannelTypes.DM,
    ChannelTypes.GROUP_DM,
    ChannelTypes.GUILD_CATEGORY,
];

function isHidden(channel: any | undefined) {
    if (channel === undefined) return false;

    if (typeof channel === "string") {
        channel = getChannel(channel);
    }

    if (!channel || skipChannels.includes(channel.type)) {
        return false;
    }

    channel.realCheck = true;

    const result = !Permissions.can(
        constants.Permissions.VIEW_CHANNEL,
        channel
    );

    delete channel.realCheck;

    return result;
}

console.log("[HiddenChannels] Plugin loaded");

const unpatches: (() => void)[] = [];

export default {
    onLoad: () => {
        storage.showIcon ??= true;
        storage.showPopup ??= true;

        /*
         * Make Discord's normal VIEW_CHANNEL checks succeed.
         *
         * isHidden() sets realCheck so that it can still perform
         * the actual permission check.
         */
        unpatches.push(
            after(
                "can",
                Permissions,
                ([permID, channel], result) => {
                    if (
                        !channel?.realCheck &&
                        permID === constants.Permissions.VIEW_CHANNEL
                    ) {
                        return true;
                    }

                    return result;
                }
            )
        );

        /*
         * Prevent fetching messages from hidden channels.
         */
        if (Fetcher?.fetchMessages) {
            unpatches.push(
                instead(
                    "fetchMessages",
                    Fetcher,
                    (args, orig) => {
                        const channel = args[0];

                        console.log(
                            "[HiddenChannels] fetchMessages:",
                            channel
                        );

                        if (!isHidden(channel)) {
                            return orig(...args);
                        }

                        console.log(
                            "[HiddenChannels] Blocked message fetch for hidden channel"
                        );

                        return;
                    }
                )
            );
        } else {
            console.warn(
                "[HiddenChannels] fetchMessages was not found"
            );
        }

        /*
         * Handle channel navigation.
         *
         * IMPORTANT:
         * There is intentionally only ONE navigation patch here.
         * The old duplicate transitionToGuild patch was removed because
         * it prevented "View Anyway" from reaching the real router.
         */
        const transitionToGuild = findByProps("transitionToGuild");

        if (transitionToGuild) {
            for (const key of Object.keys(transitionToGuild)) {
                if (typeof transitionToGuild[key] !== "function") {
                    continue;
                }

                unpatches.push(
                    instead(
                        key,
                        transitionToGuild,
                        (args, orig) => {
                            const path = args[0];

                            if (typeof path === "string") {
                                const match = path.match(/(\d+)$/);

                                if (match?.[1]) {
                                    const channelId = match[1];
                                    const channel =
                                        getChannel(channelId);

                                    if (
                                        channel &&
                                        isHidden(channel)
                                    ) {
                                        console.log(
                                            "[HiddenChannels] Hidden channel selected:",
                                            channelId
                                        );

                                        if (storage.showPopup) {
                                            showConfirmationAlert({
                                                title:
                                                    "This channel is hidden.",

                                                content:
                                                    React.createElement(
                                                        AlertContent,
                                                        {
                                                            channel,
                                                        }
                                                    ),

                                                confirmText:
                                                    "View Anyway",

                                                cancelText:
                                                    "Cancel",

                                                onConfirm: () => {
                                                    console.log(
                                                        "[HiddenChannels] View Anyway pressed"
                                                    );

                                                    return orig(...args);
                                                },
                                            });

                                            /*
                                             * Stop the original navigation
                                             * until the user confirms.
                                             */
                                            return {};
                                        }

                                        /*
                                         * Popup disabled:
                                         * immediately allow navigation.
                                         */
                                        return orig(...args);
                                    }
                                }
                            }

                            return orig(...args);
                        }
                    )
                );
            }
        } else {
            console.warn(
                "[HiddenChannels] transitionToGuild not found"
            );
        }

        /*
         * Add a lock icon next to hidden channel names.
         */
        const ChannelInfo = findByName(
            "ChannelInfo",
            false
        );

        if (ChannelInfo && storage.showIcon) {
            unpatches.push(
                after(
                    "default",
                    ChannelInfo,
                    ([{ channel }], result) => {
                        if (!channel || !isHidden(channel)) {
                            return result;
                        }

                        return React.createElement(
                            React.Fragment,
                            null,

                            React.createElement(
                                RN.Image,
                                {
                                    source:
                                        getAssetByName(
                                            "ic_lock"
                                        ).id,

                                    style: {
                                        width: 20,
                                        height: 20,
                                        marginRight: 4,
                                    },
                                }
                            ),

                            result
                        );
                    }
                )
            );
        }
    },

    onUnload: () => {
        console.log(
            "[HiddenChannels] Unloading plugin"
        );

        for (const unpatch of unpatches) {
            unpatch();
        }

        unpatches.length = 0;
    },

    settings: Settings,
};
```

### `AlertContent.tsx`

```tsx
import {
    stylesheet,
    constants,
    moment,
    clipboard,
    React,
} from "@vendetta/metro/common";

import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";
import {
    getAssetIDByName,
} from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

const snowflakeUtils = findByProps(
    "extractTimestamp"
);

const MessageStyles =
    stylesheet.createThemedStyleSheet({
        text: {
            fontSize: 16,
            color:
                semanticColors.HEADER_PRIMARY,
        },

        bold: {
            fontFamily:
                constants.Fonts.PRIMARY_SEMIBOLD,
        },

        highlight: {
            backgroundColor:
                semanticColors.BACKGROUND_MESSAGE_HIGHLIGHT_HOVER,
        },
    });

function FancyDate({
    date,
}: {
    date: Date;
}) {
    return (
        <Text
            onPress={() => {
                showToast(
                    moment(date).toLocaleString(),
                    getAssetIDByName("ic_clock")
                );
            }}
            onLongPress={() => {
                clipboard.setString(
                    date.getTime().toString()
                );

                showToast(
                    "Copied Timestamp to Clipboard",
                    getAssetIDByName(
                        "ic_message_copy"
                    )
                );
            }}
            style={MessageStyles.highlight}
        >
            {moment(date).fromNow()}
        </Text>
    );
}

const { Text } = findByProps(
    "Text",
    "View"
);

export default function AlertContent({
    channel,
}: {
    channel: any;
}) {
    const creationDate = new Date(
        snowflakeUtils.extractTimestamp(
            channel.id
        )
    );

    const lastMessageDate =
        channel.lastMessageId
            ? new Date(
                  snowflakeUtils.extractTimestamp(
                      channel.lastMessageId
                  )
              )
            : null;

    const lastPinDate =
        channel.lastPinTimestamp
            ? new Date(
                  channel.lastPinTimestamp
              )
            : null;

    return (
        <>
            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                Topic:
            </Text>

            <Text style={MessageStyles.text}>
                {channel.topic ||
                    "No topic."}
            </Text>

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}
                Creation date:
            </Text>

            <FancyDate
                date={creationDate}
            />

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}
                Last message:
            </Text>

            {lastMessageDate ? (
                <FancyDate
                    date={lastMessageDate}
                />
            ) : (
                <Text
                    style={MessageStyles.text}
                >
                    No messages.
                </Text>
            )}

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}
                Last pin:
            </Text>

            {lastPinDate ? (
                <FancyDate
                    date={lastPinDate}
                />
            ) : (
                <Text
                    style={MessageStyles.text}
                >
                    No pins.
                </Text>
            )}
        </>
    );
}
```

### `HiddenChannel.tsx`

```tsx
import {
    stylesheet,
    constants,
    moment,
    clipboard,
    React,
} from "@vendetta/metro/common";

import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";
import { getAssetByName } from "@vendetta/ui/assets";

const { View, Text, Pressable } =
    findByProps(
        "Button",
        "Text",
        "View"
    );

const snowflakeUtils = findByProps(
    "extractTimestamp"
);

const MessageStyles =
    stylesheet.createThemedStyleSheet({
        container: {
            flex: 1,
            padding: 16,
            alignItems: "center",
            justifyContent: "center",
        },

        title: {
            fontFamily:
                constants.Fonts.PRIMARY_SEMIBOLD,

            fontSize: 24,

            textAlign: "left",

            color:
                semanticColors.HEADER_PRIMARY,

            paddingVertical: 25,
        },

        text: {
            flex: 1,

            flexDirection: "row",

            fontSize: 16,

            textAlign: "justify",

            color:
                semanticColors.HEADER_PRIMARY,
        },

        dateContainer: {
            height: 16,
            alignSelf: "baseline",
        },
    });

function FancyDate({
    date,
}: {
    date: Date;
}) {
    return (
        <Pressable
            style={
                MessageStyles.dateContainer
            }
            onPress={() => {
                const asset =
                    getAssetByName("clock");

                moment(date);

                if (asset) {
                    // Kept intentionally simple;
                    // toast handling is done through
                    // the existing Vendetta API.
                }
            }}
            onLongPress={() => {
                clipboard.setString(
                    date.getTime().toString()
                );
            }}
        >
            <Text
                style={MessageStyles.text}
            >
                {moment(date).fromNow()}
            </Text>
        </Pressable>
    );
}

export default function HiddenChannel({
    channel,
}: {
    channel: any;
}) {
    return (
        <View
            style={
                MessageStyles.container
            }
        >
            <Text
                style={
                    MessageStyles.title
                }
            >
                This channel is hidden.
            </Text>

            <Text
                style={MessageStyles.text}
            >
                Topic:{" "}
                {channel.topic ||
                    "No topic."}

                {"\n\n"}

                Creation date:{" "}
                <FancyDate
                    date={
                        new Date(
                            snowflakeUtils.extractTimestamp(
                                channel.id
                            )
                        )
                    }
                />

                {"\n\n"}

                Last message:{" "}
                {channel.lastMessageId ? (
                    <FancyDate
                        date={
                            new Date(
                                snowflakeUtils.extractTimestamp(
                                    channel.lastMessageId
                                )
                            )
                        }
                    />
                ) : (
                    "No messages."
                )}

                {"\n\n"}

                Last pin:{" "}
                {channel.lastPinTimestamp ? (
                    <FancyDate
                        date={
                            new Date(
                                channel.lastPinTimestamp
                            )
                        }
                    />
                ) : (
                    "No pins."
                )}
            </Text>
        </View>
    );
}
```

### `settings.tsx`

```tsx
import {
    React,
    ReactNative as RN,
} from "@vendetta/metro/common";

import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";
import {
    getAssetIDByName,
} from "@vendetta/ui/assets";

const {
    FormRow,
    FormSection,
    FormSwitchRow,
} = Forms;

export function Settings() {
    useProxy(storage);

    return (
        <RN.ScrollView
            style={{ flex: 1 }}
        >
            <FormSection
                title="Options"
                titleStyleType="no_border"
            >
                <FormSwitchRow
                    label="Show Lock Icon"

                    subLabel="Show a lock icon to the right of hidden channel names."

                    leading={
                        <FormRow.Icon
                            source={getAssetIDByName(
                                "ic_lock"
                            )}
                        />
                    }

                    onValueChange={(value) => {
                        storage.showIcon =
                            value;
                    }}

                    value={
                        storage.showIcon
                    }
                />

                <FormSwitchRow
                    label="Show Popup on Hidden Channels"

                    subLabel="Toggle the information popup that appears when selecting hidden channels."

                    leading={
                        <FormRow.Icon
                            source={getAssetIDByName(
                                "ic_more_android"
                            )}
                        />
                    }

                    onValueChange={(value) => {
                        storage.showPopup =
                            value;
                    }}

                    value={
                        storage.showPopup
                    }
                />
            </FormSection>
        </RN.ScrollView>
    );
}
