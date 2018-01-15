import React from 'react';
import PropTypes from 'prop-types';
import Button from '/imports/ui/components/button/component';
import { defineMessages, injectIntl, intlShape } from 'react-intl';

const intlMessages = defineMessages({
  joinVideo: {
    id: 'app.video.joinVideo',
    description: 'Join video button label',
  },
  leaveVideo: {
    id: 'app.video.leaveVideo',
    description: 'Leave video button label',
  },
});

const JoinVideoOptions = (props) => {
  const {
    intl,
    isSharingVideo,
    handleJoinVideo,
    handleCloseVideo,
  } = props;

  if (isSharingVideo) {
    return (
      <Button
        onClick={handleCloseVideo}
        label={intl.formatMessage(intlMessages.leaveVideo)}
        hideLabel
        aria-label={intl.formatMessage(intlMessages.leaveVideo)}
        color="danger"
        icon="video"
        size="lg"
        circle
      />
    );
  }

  return (
    <Button
      onClick={handleJoinVideo}
      label={intl.formatMessage(intlMessages.joinVideo)}
      hideLabel
      aria-label={intl.formatMessage(intlMessages.joinVideo)}
      color="primary"
      icon="video_off"
      size="lg"
      circle
    />
  );
};

JoinVideoOptions.propTypes = {
  intl: intlShape.isRequired,
  isSharingVideo: PropTypes.bool.isRequired,
  handleJoinVideo: PropTypes.func.isRequired,
  handleCloseVideo: PropTypes.func.isRequired,
};

export default injectIntl(JoinVideoOptions);
