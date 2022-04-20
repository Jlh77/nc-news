const { commentsModel } = require("../models");

exports.removeCommentById = async (req, res, next) => {
  try {
    const { comment_id } = req.params;
    await commentsModel.deleteCommentById(comment_id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.patchIncCommentVotesById = async (req, res, next) => {
  try {
    const { comment_id } = req.params;
    const updatedComment = await commentsModel.updateIncCommentVotesById(
      comment_id
    );
    res.status(200).send({ updatedComment });
  } catch (err) {
    next(err);
  }
};
